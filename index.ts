import "./core/web-components/index.ts";
import { RavelMessenger } from "./core/web-components/common/RavelMessenger"

function foo() {
    RavelMessenger.sendMessage('foo', '', '');
}

document.querySelector('#foo')?.addEventListener('click', foo);
