#!/usr/bin/env python3
"""
Gifograf BLE GATT Server
========================
Advertises as "Gifograf" over BLE.

On connect the Response characteristic contains JSON with machine info:
    {"machine_id": "<uuid>", "location": "<location>"}

Command protocol
----------------
Send UTF-8 JSON to the Command characteristic (write):

    {"command": "wifi", "ssid": "<network>", "password": "<pass>", "location": "<loc>"}

Saves wifi_config.json and machine_config.json, then applies the new
wifi connection via nmcli.  The Response characteristic is updated with:
    "OK: connected to <ssid>"  — on success
    "ERROR: <detail>"          — on failure

While nmcli is running the response reads "Applying wifi settings…"

UUIDs
-----
    Service  : a1b2c3d4-e5f6-7890-abcd-ef1234567890
    Response : a1b2c3d4-e5f6-7890-abcd-ef1234567892  (read)
    Command  : a1b2c3d4-e5f6-7890-abcd-ef1234567891  (write)

Usage:
    sudo python console/ble_server.py
Button commands
---------------
Send UTF-8 JSON to trigger a Pygame button event in the main app:

    {"command": "button", "name": "<name>"}

Valid names: action, play, home, delete, upload, left, right, settings

"""

import json
import logging
import os
import subprocess
import sys
import threading
import time

import urllib.error
import urllib.request

import dbus
from bluezero import adapter, peripheral

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DEVICE_NAME = 'Gifograf'

# Set after deploying the Lambda (see console/ssm_activation_lambda/README.md)
SSM_LAMBDA_URL = 'https://rjcu3na2k5aty2c53slqmhmcnq0xzpzi.lambda-url.us-east-1.on.aws/'        # API Gateway endpoint URL
SSM_REGION     = 'us-east-1'

SERVICE_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
RESP_UUID    = 'a1b2c3d4-e5f6-7890-abcd-ef1234567892'
CMD_UUID     = 'a1b2c3d4-e5f6-7890-abcd-ef1234567891'

_HERE             = os.path.dirname(os.path.abspath(__file__))
_CONFIG_DIR       = os.path.join(_HERE, '..', 'config')
WIFI_CONFIG_PATH  = os.path.normpath(os.path.join(_CONFIG_DIR, 'wifi_config.json'))
MACH_CONFIG_PATH  = os.path.normpath(os.path.join(_CONFIG_DIR, 'machine_config.json'))

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(levelname)-8s  %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _load_json(path: str) -> dict:
    try:
        with open(path) as f:
            return json.load(f)
    except Exception as exc:
        log.warning('Could not load %s: %s', path, exc)
        return {}


def _read_machine_id() -> str:
    """Read the CM4 hardware serial number; fall back to machine_config.json."""
    try:
        with open('/sys/firmware/devicetree/base/serial-number') as f:
            return f.read().strip('\x00')
    except OSError:
        pass
    return _load_json(MACH_CONFIG_PATH).get('machine_id', '')


def _machine_info_bytes() -> list:
    cfg      = _load_json(MACH_CONFIG_PATH)
    wifi_cfg = _load_json(WIFI_CONFIG_PATH)
    payload = json.dumps({
        'machine_id':    _read_machine_id(),
        'location':      cfg.get('machine_location', ''),
        'wifi_network':  wifi_cfg.get('wifi_network', ''),
        'wifi_password': wifi_cfg.get('wifi_password', ''),
        'registered':    cfg.get('registered', False),
    })
    return list(payload.encode('utf-8'))


# ---------------------------------------------------------------------------
# WiFi application (mirrors SettingsConfigurator.__save_settings)
# ---------------------------------------------------------------------------
def _apply_wifi(ssid: str, password: str, location: str,
                set_response) -> None:
    """Run in a background thread.  Calls set_response(text) on completion."""
    # --- write config files -------------------------------------------------
    wifi_json = {'wifi_network': ssid, 'wifi_password': password}
    try:
        with open(WIFI_CONFIG_PATH, 'w') as f:
            json.dump(wifi_json, f, indent=2)
            f.write('\n')
    except OSError as exc:
        set_response(f'ERROR: could not write wifi_config.json — {exc}')
        return

    mach_cfg = _load_json(MACH_CONFIG_PATH)
    mach_cfg['machine_location'] = location
    try:
        with open(MACH_CONFIG_PATH, 'w') as f:
            json.dump(mach_cfg, f, indent=2)
            f.write('\n')
    except OSError as exc:
        set_response(f'ERROR: could not write machine_config.json — {exc}')
        return

    log.info('Config files written — ssid=%s  location=%s', ssid, location)

    # --- apply via nmcli (same sequence as SettingsConfigurator) ------------
    env = os.environ.copy()

    def run(cmd):
        return subprocess.check_output(cmd, shell=True, env=env,
                                       stderr=subprocess.STDOUT)

    try:
        run('nmcli radio wifi off')
        time.sleep(1)
        run('nmcli radio wifi on')
        time.sleep(3)
        run('sudo systemctl restart NetworkManager')
        time.sleep(5)
        try:
            run(f"nmcli connection delete id '{ssid}'")
        except subprocess.CalledProcessError:
            pass  # connection may not exist yet
        time.sleep(2)
        run('sudo nmcli general reload')
    except subprocess.CalledProcessError as exc:
        log.warning('nmcli reset step failed (continuing): %s',
                    exc.output.decode('utf-8', errors='replace'))

    if password:
        connect_cmd = f"nmcli -t dev wifi connect '{ssid}' password '{password}'"
    else:
        connect_cmd = f"nmcli -t dev wifi connect '{ssid}'"

    try:
        out = run(connect_cmd)
        msg = 'OK: ' + out.decode('utf-8', errors='replace').strip()
    except subprocess.CalledProcessError as exc:
        msg = 'ERROR: ' + exc.output.decode('utf-8', errors='replace').strip()

    log.info('nmcli result: %s', msg)
    set_response(msg)


# ---------------------------------------------------------------------------
# SSM registration
# ---------------------------------------------------------------------------
def _register_ssm(machine_id: str, set_response) -> None:
    """Background thread: obtain an SSM activation via Lambda, then register."""
    if not SSM_LAMBDA_URL:
        set_response('ERROR: SSM_LAMBDA_URL is not configured in ble_server.py')
        return

    payload = json.dumps({'machine_id': machine_id}).encode('utf-8')
    req = urllib.request.Request(
        SSM_LAMBDA_URL,
        data=payload,
        headers={'Content-Type': 'application/json'},
        method='POST',
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode('utf-8', errors='replace')
        set_response(f'ERROR: activation service returned {exc.code} — {body[:120]}')
        return
    except Exception as exc:
        set_response(f'ERROR: could not reach activation service — {exc}')
        return

    activation_id   = result.get('activation_id', '')
    activation_code = result.get('activation_code', '')
    region          = result.get('region', SSM_REGION)

    if not activation_id or not activation_code:
        set_response(f'ERROR: unexpected response from activation service — {result}')
        return

    log.info('Activation received: id=%s  region=%s', activation_id, region)

    try:
        subprocess.check_output(
            f'sudo amazon-ssm-agent -register -code {activation_code}'
            f' -id {activation_id} -region {region} -y',
            shell=True, stderr=subprocess.STDOUT,
        )
    except subprocess.CalledProcessError as exc:
        detail = exc.output.decode('utf-8', errors='replace').strip()
        set_response(f'ERROR: SSM registration failed — {detail[:200]}')
        return

    try:
        subprocess.check_output(
            'sudo systemctl restart amazon-ssm-agent',
            shell=True, stderr=subprocess.STDOUT,
        )
    except subprocess.CalledProcessError as exc:
        detail = exc.output.decode('utf-8', errors='replace').strip()
        set_response(f'ERROR: could not restart SSM agent — {detail[:200]}')
        return

    mach_cfg = _load_json(MACH_CONFIG_PATH)
    mach_cfg['registered'] = True
    try:
        with open(MACH_CONFIG_PATH, 'w') as f:
            json.dump(mach_cfg, f, indent=2)
            f.write('\n')
    except OSError as exc:
        log.warning('Could not persist registered flag: %s', exc)

    log.info('SSM registration complete for %s', machine_id)
    set_response(f'OK: registered as {machine_id}')


# ---------------------------------------------------------------------------
# Command handler
# ---------------------------------------------------------------------------
VALID_BUTTONS = {'action', 'play', 'home', 'delete', 'upload',
                 'left', 'right', 'settings'}


def process_command(data: list, set_response, queue=None) -> str:
    """
    Parse and execute a BLE command.  Returns an immediate response string.
    Long-running wifi work is dispatched to a background thread which calls
    set_response() when done.
    """
    try:
        msg = json.loads(bytes(data).decode('utf-8'))
    except Exception as exc:
        return f'ERROR: invalid JSON — {exc}'

    if not isinstance(msg, dict):
        return 'ERROR: expected a JSON object'

    cmd = msg.get('command')
    if cmd is None:
        return "ERROR: missing 'command' field"

    if cmd == 'wifi':
        ssid     = msg.get('ssid', '')
        password = msg.get('password', '')
        location = msg.get('location', '')

        if not isinstance(ssid, str) or not ssid:
            return "ERROR: 'wifi' requires a non-empty 'ssid' field"
        if not isinstance(password, str):
            return "ERROR: 'password' must be a string"
        if not isinstance(location, str):
            return "ERROR: 'location' must be a string"

        thread = threading.Thread(
            target=_apply_wifi,
            args=(ssid, password, location, set_response),
            daemon=True,
        )
        thread.start()
        return 'Applying wifi settings\u2026'

    if cmd == 'register':
        machine_id = _read_machine_id()
        if not machine_id:
            return 'ERROR: could not read machine ID from hardware'
        thread = threading.Thread(
            target=_register_ssm,
            args=(machine_id, set_response),
            daemon=True,
        )
        thread.start()
        return 'Registering…'

    if cmd == 'button':
        name = msg.get('name', '')
        if name not in VALID_BUTTONS:
            return f"ERROR: unknown button '{name}'. Valid: {', '.join(sorted(VALID_BUTTONS))}"
        if queue is not None:
            queue.put(name)
            log.info('Button queued: %s', name)
            return f'OK: {name}'
        return 'ERROR: button commands not available (no queue)'

    return f"ERROR: unknown command '{cmd}'"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main(queue=None):
    adapters = adapter.list_adapters()
    if not adapters:
        log.error('No Bluetooth adapter found. Is bluetoothd running?')
        sys.exit(1)

    adapter_addr = adapters[0]
    dongle = adapter.Adapter(adapter_addr)
    if not dongle.powered:
        log.info('Powering on adapter %s...', adapter_addr)
        dongle.powered = True
    dongle.alias = DEVICE_NAME
    log.info('Using adapter: %s  alias: %s', adapter_addr, DEVICE_NAME)

    app = peripheral.Peripheral(adapter_addr, local_name=DEVICE_NAME)
    app.add_service(srv_id=1, uuid=SERVICE_UUID, primary=True)

    # Shared response state.
    # wifi_pending is True while a wifi operation is in progress or has a
    # result the client hasn't yet collected.  When False, read_callback
    # returns fresh machine info so a new connection always gets a clean slate.
    current_response = _machine_info_bytes()
    wifi_pending = False

    def set_response(text: str):
        nonlocal current_response, wifi_pending
        current_response = list(text.encode('utf-8'))
        log.info('Response updated: %s', text)

    def read_callback():
        nonlocal wifi_pending
        if not wifi_pending:
            return _machine_info_bytes()
        # Once the client reads a final result, clear pending so the next
        # read (e.g. from a new connection) returns machine info again.
        data = bytes(current_response)
        if data.startswith((b'OK', b'ERROR')):
            wifi_pending = False
        return current_response

    def write_callback(value, options=None):
        nonlocal current_response, wifi_pending
        raw = bytes(value)
        log.info('Received command (%d bytes): %s', len(raw), raw)
        wifi_pending = True
        immediate = process_command(value, set_response, queue)
        log.info('Immediate response: %s', immediate)
        current_response = list(immediate.encode('utf-8'))

    # Response characteristic — client reads this
    app.add_characteristic(
        srv_id=1, chr_id=1, uuid=RESP_UUID,
        value=current_response,
        notifying=False,
        flags=['read'],
        write_callback=None,
        read_callback=read_callback,
        notify_callback=None,
    )

    # Command characteristic — client writes here
    app.add_characteristic(
        srv_id=1, chr_id=2, uuid=CMD_UUID,
        value=[],
        notifying=False,
        flags=['write', 'write-without-response'],
        write_callback=write_callback,
        read_callback=None,
        notify_callback=None,
    )

    log.info('=' * 52)
    log.info('  Advertising as : %s', DEVICE_NAME)
    log.info('  Adapter        : %s', adapter_addr)
    log.info('  Service UUID   : %s', SERVICE_UUID)
    log.info('  Response char  : %s', RESP_UUID)
    log.info('  Command  char  : %s', CMD_UUID)
    log.info('  WiFi config    : %s', WIFI_CONFIG_PATH)
    log.info('  Machine config : %s', MACH_CONFIG_PATH)
    log.info('=' * 52)
    log.info('Waiting for connections...  (Ctrl-C to stop)')

    # Set advertising interval to 100 ms
    _orig_register = app.ad_manager.register_advertisement
    def _register_with_interval(advertisement, options):
        options['MinInterval'] = dbus.UInt32(100)
        options['MaxInterval'] = dbus.UInt32(100)
        return _orig_register(advertisement, options)
    app.ad_manager.register_advertisement = _register_with_interval

    app.publish()


if __name__ == '__main__':
    main()
