Original prompt (in Ravel 2 project):
This repo contains the Ravel Web Component design system. Can you Please create a document that describes this project and provides some guidance for someone who wants to make the next generation Web Component design system based on this? Please take into account the pincipals, requirements, and guidelines in the SOUL.md document. The goal here is to create a SOUL-SPEC.md document that can be used to seed a Claude skill that would help an agent create the said design system incrementally in the future, in partnership with a human. 


To give some indication of how to weigh the (sometimes competing) parts of this Soul Doc, I've divided them into three groups:

A. Core Principals
B. Core Requirements
C. Core Guidelines

A. Core Principals

1. Human-Centered, Accessibility First: AAA WCAG-compliance goal. Good design is accessible design. Meet where they are at. Accessibility is difficut to retrofit.

2. Strive For the Bare Maximum: A Buckminster Fuller notion.

3. Joy and Color: Susan Kare's bitmaps and Cairo font on the original Mac are an example. Easter eggs, Silly tiny tools. "An unprofessional tool for pros". Color in every sense.

4. Human In the Loop: A general architure and methodology that acknowledges the cognitive debt service required for a human to collaborate on the project. 

5. Asimov's Laws: Should probably be incorporated into every software project.

B. Core Requirements

1. Plain Vanilla Typescript: No frameworks. Best practices but nothing fancy or clever for cleverness sake. Plain Vanilla as the goal of an ascetic mystic wandering wizard, not a Conservative or Penny Pincher.

2. Everything a Web Component: Components should be self contained but can have certain features that only work A lack of other element on a page should not "crash" a component, but it may silently "fail to behave" if the collaborating elements are not available.

3. Brokers as first class web components: For example, the Message Broker is a pub/sub object that handles messaging. It exists as a Web Component element on the page and not as a global function. Theme Broker
 
4. Encapsulated: Components should be as self contained as possible. Keep the base and inherited classes to a well-curated minimum. 

5. Deploy at any scale: You should not have to include the entire design system to use a subset of the system. Pick and choose components from a "menu".

6. Themes: Every component should be individually themable, or themed as a group (depending on attributes). Vibrant color everywhere

7. Observability: Web Components should be able to log their activities and visualize their internals. These can be exposed as attributes.

C. Core Guidelines

1. Literate programming: Prompts should be an integral part of development library.

2. Low Dependencies but Leverage Vetted Libraries: Try to avoid using unnecessary libraries, but go all in on non-wheel-reinventing vetted utility libraries. Also robust niche application libraries (e.g. Blockly, Starlette, etc)

3. Pen and Paper, Stones and Sticks: Computer Vision-Aided non-digital input devices. E.g. turn an assembly of pebbles into a flexbox UI

4. Alternative Displays: I suppose you could call them surfaces (Let's come up with a better name). Take into account alternative displays, e.g. https://blair-neal.gitbook.io/survey-of-alternative-displays


