import { RavelElement } from '../../../base/ravel-element/src/RavelElement.js';
import globalStyles from '../../../../common/global-styles.js';

// aliases for box2d stuff. Makes life easier.
var b2Vec2 = Box2D.Common.Math.b2Vec2
, b2AABB = Box2D.Collision.b2AABB
, b2BodyDef = Box2D.Dynamics.b2BodyDef
, b2Body = Box2D.Dynamics.b2Body
, b2FixtureDef = Box2D.Dynamics.b2FixtureDef
, b2Fixture = Box2D.Dynamics.b2Fixture
, b2World = Box2D.Dynamics.b2World
, b2MassData = Box2D.Collision.Shapes.b2MassData
, b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape
, b2CircleShape = Box2D.Collision.Shapes.b2CircleShape
, b2DebugDraw = Box2D.Dynamics.b2DebugDraw
,  b2MouseJointDef =  Box2D.Dynamics.Joints.b2MouseJointDef
;

window.requestAnimFrame = (function(){
          return  window.requestAnimationFrame       || 
                  window.webkitRequestAnimationFrame || 
                  window.mozRequestAnimationFrame    || 
                  window.oRequestAnimationFrame      || 
                  window.msRequestAnimationFrame     || 
                  function(/* function */ callback, /* DOMElement */ element){
                        window.setTimeout(callback, 1000 / 60);
                  };
    })();
    
export class RavelPhysicsWorld extends RavelElement {
    static get localStyles() {
        return `
        <style>
        #container {
            position: absolute;
            top: 0px;
            left: 0px;
            width: 100%;
            height: 100%;
            background-image: #000000;
            background-size: contain;
	        image-rendering: pixelated;
            pointer-events: auto;
            border: 2px dotted #ffff00;
        }
        </style>
        `;
    }
  
    static get html() { 
        return `
        <div id="container">
        <div id="playfield">
        <slot></slot>
        </div>
        </div>
        `;
    }
 
    static get observedAttributes() { 
        return [...super.baseObservedAttributes, 'damping', 'width', 'height'];
    }

    constructor() {
        super();
        const template = document.createElement('template');
        template.innerHTML = globalStyles
            + this.constructor.localStyles
            + this.constructor.html;
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.appendChild(template.content.cloneNode(true));
        this.initialize();
    }
  
    connectedCallback() {
        this.setup();
    }
    
    disconnectedCallback() {
        this.teardown();
    }
    
    initialize() {
        this.container = this.shadowRoot.querySelector('#container');
        this.playfield = this.shadowRoot.querySelector('#playfield');
        this.slots = this.shadowRoot.querySelectorAll('slot');
    }
  
    setup = () => {
        this.pixelsToWorld = 30.0;
        let rect = this.container.getBoundingClientRect();
        this.x = rect.left;
        this.y = rect.top;
        console.log(`Rect: ${this.x} ${this.y}`);
        if (!this.width) this.width = rect.width;
        if (!this.height) this.height = rect.height;
        console.log(`Dim: ${this.width} ${this.height}`);
        // console.log(rect);
        this.world = null;
        this.grabbedIndex = -1;
        this.dampingRatio = 0.0;
        this.playfieldMembers = [];
        this.values = [];
        this.prevValues = [];
        this.world = new b2World(new b2Vec2(0, 0), true);
        rect = this.container.getBoundingClientRect();
        console.log(`Dim: ${this.width} ${this.height}`);
        this.initWorld();
        
        //this.observedMessages = ['message'];
        //this.subscribe(this.observedMessages);  
        
        /*this.shadowRoot.querySelector('#impulse').addEventListener('click', () => {
            for (let j = 0; j < this.playfieldMembers.length; j++) {
                console.log("Apply Impulse");
                console.log(this.playfieldMembers[j]);
                console.log(this.playfieldMembers[j].size);
                console.log(this.playfieldMembers[j].body);
                console.log(Number(this.playfieldMembers[j].body.GetAngle()));
                console.log(Number(this.playfieldMembers[j].body.GetPosition().x));
                console.log(this.playfieldMembers[j].body.GetPosition().y);
                console.log(this.playfieldMembers[j].body.GetAngularVelocity());
                this.playfieldMembers[j].body.ApplyImpulse(new b2Vec2(200, 200), this.playfieldMembers[j].body.GetWorldCenter());
            }
        }) */
    }
    
    initWorld() {
    	let fixDef = new b2FixtureDef;
    	fixDef.density = 1.0;
    	fixDef.restitution = 1.0;
    	fixDef.friction = 1.0;
        this.lookup = {};
        //for (i = 0; i < nFluxum; i++) {
        //	fluxum.push(new Fluxum(world, i, Math.random() * width - FLUXUM_W/2, Math.random() * height - FLUXUM_W/2, FLUXUM_W/2, FLUXUM_W/2, 10, 0));
        //}
        console.log('boundaries');
        console.log(`0, 0, ${this.width}, 10`);
        console.log(`${this.width}, 0, 10, ${this.height}`);
        console.log(`0, ${this.height}, ${this.width}, 10`);
        console.log(`0, 0, 10, ${this.height}`);
        this.boundaries = [];
	    this.boundaries.push(this.newBoundary(0, 0, this.width, 10));  // top
    	this.boundaries.push(this.newBoundary(this.width, 0, 10, this.height));  // right
    	this.boundaries.push(this.newBoundary(0, this.height, this.width, 10));  // bottom
    	this.boundaries.push(this.newBoundary(0, 0, 10, this.height));  // left
        // console.log(this.boundaries);
        
    	this.listener = new Box2D.Dynamics.b2ContactListener;       
        this.listener.BeginContact = (contact) => {
        	//console.log(contact);
        }
        this.world.SetContactListener(this.listener);
        this.mouseDownCallback = this.mouseDown.bind(this);
        this.mouseMovedCallback = this.mouseMoved.bind(this);
        this.mouseReleasedCallback = this.mouseReleased.bind(this);
        this.updateCallback = this.update.bind(this);
        this.addEventListener('pointerdown', this.mouseDownCallback);
        this.addEventListener('pointermove', this.mouseMovedCallback);
        this.addEventListener('pointerleave', this.mouseReleasedCallback);
        this.addEventListener('pointerup', this.mouseReleasedCallback);

        // Add children of playfield to playfieldMembers
        //let fluxum = this.shadowRoot.querySelectorAll("ravel-fluxum");
        // console.log(this.slots[0].assignedNodes());
        for (let member of this.slots[0].assignedNodes()) {
            if (member.tagName === 'RAVEL-FLUXUM') {
                this.lookup[member.id] = this.playfieldMembers.length;
                this.playfieldMembers.push(this.newFluxum(member));
                this.values.push(0);
                this.prevValues.push(0);
            }
            if (member.tagName === 'RAVEL-PHYSICS-SPRITE') {
                this.lookup[member.id] = this.playfieldMembers.length;
                this.playfieldMembers.push(this.newSprite(member));
            }
            if ((member.tagName === 'RAVEL-PHYSICS-POT') ||
                (member.tagName === 'RAVEL-PHYSICS-SLIDER') ||
                (member.tagName === 'RAVEL-PHYSICS-BUTTON')) {
                this.lookup[member.id] = this.playfieldMembers.length;
                this.playfieldMembers.push(this.newControl(member));
            }
        }
        
        window.addEventListener('resize', () => {
            // Reset the top and left. The world is already sized at previous width so leave it at that.
            let rect = this.getBoundingClientRect();
            this.x = rect.x;
            this.y = rect.y;
            // console.log(`New x y ${this.x} ${this.y}`)
        }, true);
        
        requestAnimFrame(this.updateCallback);
        
        /* // DEBUG
        for (let j = 0; j < this.playfieldMembers.length; j++) {
            console.log(this.playfieldMembers[j].element);
            console.log(this.playfieldMembers[j].size);
            console.log(this.playfieldMembers[j].body);
            console.log(this.playfieldMembers[j].body.GetAngle());
            console.log(this.playfieldMembers[j].body.GetPosition().x);
            console.log(this.playfieldMembers[j].body.GetPosition().y);
            console.log(this.playfieldMembers[j].body.GetAngularVelocity());
        }
        */
    }
    
    update() {
        for (let j = 0; j < this.playfieldMembers.length; j++) {
            this.playfieldMembers[j].element.transform(
                this.playfieldMembers[j].body.GetPosition().x * this.pixelsToWorld - (this.playfieldMembers[j].size),
                this.playfieldMembers[j].body.GetPosition().y * this.pixelsToWorld - (this.playfieldMembers[j].size),
                this.playfieldMembers[j].body.GetAngle()
            );
            this.values[j] = this.playfieldMembers[j].body.GetAngularVelocity();
            if (this.values[j] !== this.prevValues[j]) {
                this.sendMessage(`fluxum-${j + 1}`, 'playback-rate', this.values[j]);
            }
            this.prevValues = this.values[j];
		}
        this.world.Step(1/30, 10, 10);
        requestAnimFrame(this.updateCallback);
    }
    
    teardown = () => {
       // this.unsubscribe(this.observedMessages);
    }

    newFluxum(fluxumElement) {
        let x = parseInt(fluxumElement.getAttribute('x'), 10);
        let y = parseInt(fluxumElement.getAttribute('y'), 10);
        let size = parseInt(fluxumElement.getAttribute('size'), 10) * 0.45;
    	let fixDef = new b2FixtureDef;
    	fixDef.density = 1.0;
    	fixDef.restitution = 0.5;
    	fixDef.friction = 1.0;

    	let bodyDef = new b2BodyDef;
    	bodyDef.position.x = x / this.pixelsToWorld;
    	bodyDef.position.y = y / this.pixelsToWorld;
    	bodyDef.type = b2Body.b2_dynamicBody;

    	fixDef.shape = new b2CircleShape;
    	fixDef.shape.SetRadius(size / (this.pixelsToWorld), size / (this.pixelsToWorld));

    	let body = this.world.CreateBody(bodyDef);
    	body.CreateFixture(fixDef);
    	//so that we can access element from box2d
    	body.SetUserData(fluxumElement);
        fluxumElement.body = body;
        
        return ({
            element: fluxumElement,
            size: size,
            body: body
         });
    }
    
    newBoundary(x, y, w, h){
    	let bodyDef = new b2BodyDef;
	    // console.log(x + y + w + h);
    	bodyDef.position.x = x / this.pixelsToWorld;
    	bodyDef.position.y = y / this.pixelsToWorld;
    	bodyDef.type = b2Body.b2_staticBody;
	
    	let body = this.world.CreateBody(bodyDef);
	
    	let fixDef = new b2FixtureDef;
    	fixDef.density = 1.0;
    	fixDef.restitution = 0.5;
    	fixDef.friction = 1.0;
	
    	fixDef.shape = new b2PolygonShape;
    	fixDef.shape.SetAsBox(w / this.pixelsToWorld, h / this.pixelsToWorld);
    	body.CreateFixture(fixDef);
    
        return body;
    }
    
    mouseDown(evt) { 
        for (let j = 0; j < this.playfieldMembers.length; j++) {
            if (this.mouseInBounds(evt.clientX, evt.clientY, 
                              this.playfieldMembers[j].body.GetPosition().x * this.pixelsToWorld,
                              this.playfieldMembers[j].body.GetPosition().y * this.pixelsToWorld,
                              this.playfieldMembers[j].size
                )) {
            	this.mouse_pressed = true;
            	this.grabbedIndex = j;
                //console.log(this.playfieldMembers[this.grabbedIndex].body);
            }
        }
    }
    
    mouseMoved(evt) {
        //console.log('mouse move ' + evt.clientX + " " + evt.clientY);
    	let p = new b2Vec2((evt.clientX - this.x) / this.pixelsToWorld, (evt.clientY - this.y) / this.pixelsToWorld);
	
    	if (this.mouse_pressed && !this.mouse_joint && this.grabbedIndex >= 0)
    	{
    		//if no joint exists then create
    		let def = new b2MouseJointDef();
	        // console.log(this.boundaries[0]);
            // console.log(this.playfieldMembers[this.grabbedIndex].body);
    		def.bodyA = this.boundaries[0];
    		def.bodyB = this.playfieldMembers[this.grabbedIndex].body;
    		def.target = p;

    		def.collideConnected = true;
    		def.maxForce = 1000 * this.playfieldMembers[this.grabbedIndex].body.GetMass();
    		def.dampingRatio = this.dampingRatio;
	
    		this.mouse_joint = this.world.CreateJoint(def);
	
    		this.playfieldMembers[this.grabbedIndex].body.SetAwake(true);
    	}

    	if (this.mouse_joint)
    	{
    		this.mouse_joint.SetTarget(p);
    	}
    }
   
    mouseReleased(evt) {
        //console.log(this.mouse_joint);
        this.grabbedIndex = -1;
    	this.mouse_pressed = false;
    	if (this.mouse_joint)
    	{
    		this.world.DestroyJoint(this.mouse_joint);
    		this.mouse_joint = false;
    	}
    }

    mouseInBounds(mx, my, x1, y1, radius) {
       // rect = element.getBoundingClientRect();
       // console.log(rect.top, rect.right, rect.bottom, rect.left);
        
        //console.log(radius);
	    // console.log ("x: " + (x1 - radius) + " < " + mx + " < " + (x1 + radius));
		// console.log ("y: " + (y1 - radius) + " < " + my + " < " + (y1 + radius));
        // Take into account this.x and y, the offset of the enclosing container
        const rect = this.container.getBoundingClientRect();

        mx = mx - rect.left;
        my = my - rect.top;
        console.log(rect.width);
        //console.log(`${mx}, ${my} : ${x1}, ${y1}`);
		/*if ((mx < (x1 + this.x + radius)) &&
		    (mx > (x1 + this.x - radius)) &&
			(my < (y1 + this.y + radius)) &&
			(my > (y1 + this.y - radius))) {
        */
        if ((mx < (x1 + radius)) &&
		    (mx > (x1 - radius)) &&
			(my < (y1 + radius)) &&
			(my > (y1 - radius))) {
                console.log('mouse in bounds ');
				return true;
		} else {
            console.log('not in bounds');
			return false;
		}
	}
        
    attributeChangedCallback(name, oldValue, newValue) {
        // Call the parent's attributeChangedCallback to preserve its behavior
        super.attributeChangedCallback(name, oldValue, newValue);
        
        if (name === 'damping') {
            this.dampingRatio = Number(newValue);
        }
        if (name === 'width') {
            this.width = Number(newValue);
        }
        if (name === 'height') {
            this.height = Number(newValue);
        }
    }
}



/* // Original code:

function Fluxum(id_, x_, y_, w_, h_, mass_){

    this.id = id_;
	this.x = x_;
	this.y = y_;
	this.mass = mass_;
	this.width = w_;    
	this.height = h_;
	this.world_radius = this.width / PIXELS_TO_WORLD;
	this.body = null;
    this.sprite = img[id_ % maxFluxum];

	var fixDef = new b2FixtureDef;
	fixDef.density = 1.0;
	fixDef.restitution = RESTITUTION;
	fixDef.friction = 1.0;

	var bodyDef = new b2BodyDef;
	bodyDef.position.x = this.x/PIXELS_TO_WORLD;
	bodyDef.position.y = this.y/PIXELS_TO_WORLD;
	bodyDef.type = b2Body.b2_dynamicBody;

	fixDef.shape = new b2CircleShape;
	fixDef.shape.SetRadius(this.width/(PIXELS_TO_WORLD), this.height/(PIXELS_TO_WORLD));

	this.body = world.CreateBody(bodyDef);
	this.body.CreateFixture(fixDef);
    
	//so that we can access element from box2d
	this.body.SetUserData(this);
	
	this.mouseInBounds = function() {
		var mx = mouseX / PIXELS_TO_WORLD;
		var my = mouseY / PIXELS_TO_WORLD;
		var x1 = this.body.GetPosition().x;
		var y1 = this.body.GetPosition().y;
		
	    //console.log ("x: " + (x1 - this.world_radius) + " < " + mx + " < " + (x1 + this.world_radius));
		//console.log ("y: " + (y1 - this.world_radius) + " < " + my + " < " + (y1 + this.world_radius));
		if ((mx < (x1 + this.world_radius)) &&
		    (mx > (x1 - this.world_radius)) &&
			(my < (y1 + this.world_radius)) &&
			(my > (y1 - this.world_radius))) {
				return true;
		} else {
			return false;
		}
	}
	
	this.tempo = 0;
	this.prevTempo = 0; 
	this.spinning = false;
    this.prevSpinning = false;
	
	this.updateAudioRate = function() {
        this.tempo = (this.body.GetAngularVelocity())*3;
        if (this.tempo != this.prevTempo) {
			//console.log("Set " + this.tempo);
            // set tempo
			//updateSlider(this.tempo, this.id);
        } 
		this.prevTempo = this.tempo;
        if (abs(this.tempo) > 0.015) {
			this.prevSpinning = this.spinning;
            this.spinning = true;
        } else {
			this.prevSpinning = this.spinning;
            this.spinning = false;
        }
	    if (!this.prevSpinning && this.spinning) {
	        // turn on
			//playSound(this.id);
			this.prevSpinning = true;
	    }
	    if (this.prevSpinning && !this.spinning) {
	        // turn off
			//stopSound(this.id);
			this.prevSpinning = false;
	    }
		//console.log("tempo " + this.tempo + " spinning " + this.spinning );
	}
}
*/