import { RavelElement } from '../../../../common/RavelElement';

// ── Minimal Box2D type declarations ──────────────────────────────────────────
// Box2D is loaded as a global <script> (Box2d.min.js); not an npm package.

interface B2Vec2 { x: number; y: number; }

interface B2CircleShape  { SetRadius(rx: number, ry: number): void; }
interface B2PolygonShape { SetAsBox(halfW: number, halfH: number): void; }

interface B2FixtureDef {
    density:     number;
    restitution: number;
    friction:    number;
    shape:       B2CircleShape | B2PolygonShape | null;
}

interface B2BodyDef {
    position: B2Vec2;
    type:     number;
}

interface B2Body {
    GetPosition():        B2Vec2;
    GetAngle():           number;
    GetAngularVelocity(): number;
    GetMass():            number;
    GetWorldCenter():     B2Vec2;
    SetAwake(flag: boolean): void;
    CreateFixture(def: B2FixtureDef): unknown;
    SetUserData(data: unknown): void;
}

interface B2MouseJoint { SetTarget(p: B2Vec2): void; }

interface B2MouseJointDef {
    bodyA:            B2Body;
    bodyB:            B2Body;
    target:           B2Vec2;
    collideConnected: boolean;
    maxForce:         number;
    dampingRatio:     number;
}

interface B2ContactListener { BeginContact: (contact: unknown) => void; }

interface B2World {
    CreateBody(def: B2BodyDef):         B2Body;
    DestroyJoint(joint: B2MouseJoint):  void;
    CreateJoint(def: B2MouseJointDef):  B2MouseJoint;
    Step(dt: number, vIter: number, pIter: number): void;
    SetContactListener(l: B2ContactListener): void;
}

interface Box2DGlobal {
    Common: { Math: { b2Vec2: new (x: number, y: number) => B2Vec2 } };
    Collision: {
        Shapes: {
            b2CircleShape:  new () => B2CircleShape;
            b2PolygonShape: new () => B2PolygonShape;
        };
    };
    Dynamics: {
        b2World:          new (gravity: B2Vec2, allowSleep: boolean) => B2World;
        b2Body:           { b2_dynamicBody: number; b2_staticBody: number };
        b2BodyDef:        new () => B2BodyDef;
        b2FixtureDef:     new () => B2FixtureDef;
        b2ContactListener: new () => B2ContactListener;
        Joints: { b2MouseJointDef: new () => B2MouseJointDef };
    };
}

// ── Physics member descriptor ─────────────────────────────────────────────────

interface PhysicsMember {
    element: Element & { transform(x: number, y: number, angle: number): void };
    size:    number;        // half-radius in px
    body:    B2Body;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * A 2-D physics sandbox powered by Box2D (loaded globally as `Box2d.min.js`).
 *
 * Slot `<ravel-fluxum>` elements inside the world — they are picked up at setup,
 * given circular Box2D bodies, and their position/rotation is updated every frame
 * via `element.transform(x, y, angleRad)`.
 *
 * Mouse / touch drag creates a spring joint, letting users fling elements around.
 *
 * Angular velocity is broadcast each frame per element on channel `fluxum-N`
 * (cmd: `'playback-rate'`), so `<ravel-fluxly-sound-engine>` can react to spinning.
 *
 * ### Attributes
 * | Attribute | Type   | Default | Description                              |
 * |-----------|--------|---------|------------------------------------------|
 * | `damping` | number | `0.0`   | Mouse-joint damping ratio (0 = springy)  |
 * | `width`   | number | auto    | World width in px (auto from layout)     |
 * | `height`  | number | auto    | World height in px (auto from layout)    |
 *
 * ### Notes
 * - Box2D **must** be loaded before this element: `<script src="/core/libs/Box2d.min.js">`
 * - World gravity is (0, 0) — elements float and bounce off walls.
 * - Only `<ravel-fluxum>` children are registered as physics bodies.
 */
export class RavelPhysicsWorld extends RavelElement {

    // ── Styles ────────────────────────────────────────────────────────────────

    private static readonly localStyles = `
        :host {
            display: block;
            position: relative;
            overflow: hidden;
            touch-action: none;
            box-sizing: border-box;
        }
        #container {
            position: absolute;
            inset: 0;
            border: 2px dotted rgba(167,255,0,0.25);
        }
    `;

    private static readonly componentHtml = `<slot></slot>`;

    // ── Observed attributes ───────────────────────────────────────────────────

    static get observedAttributes(): string[] {
        return [...RavelElement.baseObservedAttributes, 'damping', 'width', 'height'];
    }

    // ── DOM refs ──────────────────────────────────────────────────────────────

    private _slotEl!: HTMLSlotElement;

    // ── Physics state ─────────────────────────────────────────────────────────

    private _world:       B2World | null = null;
    private _boundaries:  B2Body[]       = [];
    private _members:     PhysicsMember[] = [];
    private _values:      number[]        = [];
    private _prevValues:  number[]        = [];
    private _lookup:      Record<string, number> = {};

    private _mouseJoint:   B2MouseJoint | null = null;
    private _mousePressed  = false;
    private _grabbedIndex  = -1;

    // ── Dimensions ────────────────────────────────────────────────────────────

    private readonly _ptw   = 30.0;  // pixels-to-world scale factor
    private _worldW         = 0;
    private _worldH         = 0;
    private _offsetX        = 0;
    private _offsetY        = 0;
    private _dampingRatio   = 0.0;

    // ── Loop ──────────────────────────────────────────────────────────────────

    private _rafId:  number | null = null;
    private _isReady = false;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelPhysicsWorld.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = RavelPhysicsWorld.componentHtml;
        this._slotEl = this.container.querySelector<HTMLSlotElement>('slot')!;
    }

    protected setup(): void {
        super.setup();
        this._isReady = true;
        this._initWorld();
    }

    protected teardown(): void {
        this._isReady = false;

        if (this._rafId !== null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }

        this.removeEventListener('pointerdown',  this._onPointerDown);
        this.removeEventListener('pointermove',   this._onPointerMove);
        this.removeEventListener('pointerleave',  this._onPointerRelease);
        this.removeEventListener('pointerup',     this._onPointerRelease);
        window.removeEventListener('resize',      this._onResize);

        this._mouseJoint  = null;
        this._world       = null;
        this._members     = [];
        this._values      = [];
        this._prevValues  = [];
        this._lookup      = {};
        this._boundaries  = [];

        super.teardown();
    }

    // ── Attribute changes ─────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        if (oldValue === newValue) return;
        if (name === 'damping') this._dampingRatio = Number(newValue) || 0;
    }

    // ── World init ────────────────────────────────────────────────────────────

    private _initWorld(): void {
        const B = this._box2d();
        if (!B) return;

        const rect = this.getBoundingClientRect();
        this._offsetX = rect.left;
        this._offsetY = rect.top;

        const wAttr = Number(this.getAttribute('width'));
        const hAttr = Number(this.getAttribute('height'));
        this._worldW = (rect.width  > 0 ? rect.width  : 0) || (wAttr > 0 ? wAttr : 800);
        this._worldH = (rect.height > 0 ? rect.height : 0) || (hAttr > 0 ? hAttr : 600);

        this._world = new B.Dynamics.b2World(new B.Common.Math.b2Vec2(0, 0), true);

        // Walls (top, right, bottom, left)
        this._boundaries = [
            this._newBoundary(B, 0,            0,            this._worldW, 10),
            this._newBoundary(B, this._worldW, 0,            10,           this._worldH),
            this._newBoundary(B, 0,            this._worldH, this._worldW, 10),
            this._newBoundary(B, 0,            0,            10,           this._worldH),
        ];

        const listener = new B.Dynamics.b2ContactListener();
        listener.BeginContact = (_contact: unknown): void => { /* noop */ };
        this._world.SetContactListener(listener);

        // Register slotted ravel-fluxum elements
        for (const node of this._slotEl.assignedNodes()) {
            if (!(node instanceof Element)) continue;
            if (node.tagName === 'RAVEL-FLUXUM') {
                const member = this._newFluxum(B, node as Element & {
                    transform(x: number, y: number, a: number): void;
                });
                if (member) {
                    this._lookup[node.id]  = this._members.length;
                    this._members.push(member);
                    this._values.push(0);
                    this._prevValues.push(0);
                }
            }
        }

        this.addEventListener('pointerdown',  this._onPointerDown);
        this.addEventListener('pointermove',   this._onPointerMove);
        this.addEventListener('pointerleave',  this._onPointerRelease);
        this.addEventListener('pointerup',     this._onPointerRelease);
        window.addEventListener('resize',      this._onResize);

        this._rafId = requestAnimationFrame(this._animate);
    }

    // ── Animation loop ────────────────────────────────────────────────────────

    private _animate = (): void => {
        if (!this._isReady || !this._world) return;

        for (let j = 0; j < this._members.length; j++) {
            const m   = this._members[j];
            const pos = m.body.GetPosition();
            m.element.transform(
                pos.x * this._ptw - m.size,
                pos.y * this._ptw - m.size,
                m.body.GetAngle()
            );
            this._values[j] = m.body.GetAngularVelocity();
            if (this._values[j] !== this._prevValues[j]) {
                this.sendMessage(`fluxum-${j + 1}`, 'playback-rate', this._values[j]);
            }
            this._prevValues[j] = this._values[j];
        }

        this._world.Step(1 / 30, 10, 10);
        this._rafId = requestAnimationFrame(this._animate);
    };

    // ── Pointer handlers ──────────────────────────────────────────────────────

    private _onPointerDown = (e: PointerEvent): void => {
        for (let j = 0; j < this._members.length; j++) {
            const m   = this._members[j];
            const pos = m.body.GetPosition();
            if (this._hitTest(e.clientX, e.clientY,
                    pos.x * this._ptw, pos.y * this._ptw, m.size)) {
                this._mousePressed  = true;
                this._grabbedIndex  = j;
                return;
            }
        }
    };

    private _onPointerMove = (e: PointerEvent): void => {
        if (!this._world) return;
        const B = this._box2d();
        if (!B) return;

        const rect = this.container.getBoundingClientRect();
        const p    = new B.Common.Math.b2Vec2(
            (e.clientX - rect.left) / this._ptw,
            (e.clientY - rect.top)  / this._ptw
        );

        if (this._mousePressed && !this._mouseJoint && this._grabbedIndex >= 0) {
            const def         = new B.Dynamics.Joints.b2MouseJointDef();
            def.bodyA         = this._boundaries[0];
            def.bodyB         = this._members[this._grabbedIndex].body;
            def.target        = p;
            def.collideConnected = true;
            def.maxForce      = 1000 * this._members[this._grabbedIndex].body.GetMass();
            def.dampingRatio  = this._dampingRatio;
            this._mouseJoint  = this._world.CreateJoint(def);
            this._members[this._grabbedIndex].body.SetAwake(true);
        }

        if (this._mouseJoint) this._mouseJoint.SetTarget(p);
    };

    private _onPointerRelease = (_e: PointerEvent): void => {
        this._grabbedIndex  = -1;
        this._mousePressed  = false;
        if (this._mouseJoint && this._world) {
            this._world.DestroyJoint(this._mouseJoint);
            this._mouseJoint = null;
        }
    };

    private _onResize = (): void => {
        const rect   = this.getBoundingClientRect();
        this._offsetX = rect.left;
        this._offsetY = rect.top;
    };

    // ── Body factories ────────────────────────────────────────────────────────

    private _newFluxum(
        B:   Box2DGlobal,
        el:  Element & { transform(x: number, y: number, a: number): void }
    ): PhysicsMember | null {
        const x    = parseInt(el.getAttribute('x') ?? '0', 10);
        const y    = parseInt(el.getAttribute('y') ?? '0', 10);
        const size = parseInt(el.getAttribute('size') ?? '50', 10) * 0.45;

        const fixDef          = new B.Dynamics.b2FixtureDef();
        fixDef.density        = 1.0;
        fixDef.restitution    = 0.5;
        fixDef.friction       = 1.0;

        const bodyDef          = new B.Dynamics.b2BodyDef();
        bodyDef.position.x     = x / this._ptw;
        bodyDef.position.y     = y / this._ptw;
        bodyDef.type           = B.Dynamics.b2Body.b2_dynamicBody;

        const circle = new B.Collision.Shapes.b2CircleShape();
        circle.SetRadius(size / this._ptw, size / this._ptw);
        fixDef.shape = circle;

        const body = this._world!.CreateBody(bodyDef);
        body.CreateFixture(fixDef);
        body.SetUserData(el);

        return { element: el, size, body };
    }

    private _newBoundary(B: Box2DGlobal, x: number, y: number, w: number, h: number): B2Body {
        const bodyDef       = new B.Dynamics.b2BodyDef();
        bodyDef.position.x  = x / this._ptw;
        bodyDef.position.y  = y / this._ptw;
        bodyDef.type        = B.Dynamics.b2Body.b2_staticBody;

        const body    = this._world!.CreateBody(bodyDef);
        const fixDef  = new B.Dynamics.b2FixtureDef();
        fixDef.density     = 1.0;
        fixDef.restitution = 0.5;
        fixDef.friction    = 1.0;

        const poly = new B.Collision.Shapes.b2PolygonShape();
        poly.SetAsBox(w / this._ptw, h / this._ptw);
        fixDef.shape = poly;
        body.CreateFixture(fixDef);

        return body;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private _hitTest(mx: number, my: number, cx: number, cy: number, r: number): boolean {
        const rect = this.container.getBoundingClientRect();
        const lx   = mx - rect.left;
        const ly   = my - rect.top;
        return lx > cx - r && lx < cx + r && ly > cy - r && ly < cy + r;
    }

    private _box2d(): Box2DGlobal | null {
        const B = (window as unknown as { Box2D?: Box2DGlobal }).Box2D;
        if (!B) {
            console.warn('[ravel-physics-world] Box2D not found — add <script src="/core/libs/Box2d.min.js"> before this element.');
            return null;
        }
        return B;
    }
}
