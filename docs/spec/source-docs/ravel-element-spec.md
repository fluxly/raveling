# RavelElement

A RavelElement is the base class for all Raveling custom elements. It can take four forms/modes:

1. Inline: position (and sometimes dimensions) determined by placement in parent
2. Draggable: Absolute positioning, draggable and droppable. May sometimes receive dragged drops.
3. Factory: Creates copies of itself (behaves like inline)
4. Physics: Position and interaction determined by a parent RavelPhysicsWorld

Inline is the default behavior. RavelDraggableElement and RavelPhysicsElement should extend RavelElement. The Factory mode is a built-in capability that can be enabled/toggled via an attribute. A Factory element renders exactly like the element, but all interaction and other behaviors are muted and replaced by its self-spawning behavior.

Design of elements is subject to the SOUL-SPEC.md; in particular pay attention to these properties:

1. Accessibility: Every element should be AAA WCAG-compliant
2. Themeable: Every element can be themed by the ravel-theme-broker element
3. Messagable: Every element can pub/sub custom messages via the RavelMessenger
4. Signalable: Every element can define signals in and signals out as attributes (signals are a special subset of messages managed by the ravel-signals-broker)
4. Observable: Every element should have a popup custom dashboard for debugging and observable (set by a modal flag)
5. Discoverable: The code should be written, organized and documented ina way that is easily discoverable so agents can maintain and expand the code base.
6. Dockable: Every element should be able to send a "dock me!" message to a ravel-dock and be minimized and captured by the dock. 
7. Virtual Events: Every element can potentially have listeners that respond to "virtual" versions of browser events (e.g. 'click', 'drag-begin', 'drag-end' etc.)

