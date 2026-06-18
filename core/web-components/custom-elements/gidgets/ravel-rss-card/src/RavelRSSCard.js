import { RavelElement } from '../../../base/ravel-element/src/RavelElement.js';
import globalStyles from '../../../../common/global-styles.js';
import { RavelEmoji } from '../../../../../modules/RavelEmoji.js';
import { componentPath } from '../../../../common/RavelComponentPath.js';

export class RavelRSSCard extends RavelElement {
    static get localStyles() {
        return `
        <style>
            #card {
              border: 1px solid #ccc;
              padding: 1em;
              border-radius: 8px;
              cursor: pointer;
              background: #fafafa;
              max-width: 400px;
              transition: box-shadow 0.2s;
            }
            #card:hover {
              box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            }
            #modal {
              position: fixed;
              top: 0; left: 0; right: 0; bottom: 0;
              background: rgba(0,0,0,0.7);
              display: none;
              justify-content: center;
              align-items: center;
              z-index: 9999;
            }
            #modal.active {
              display: flex;
            }
            #modal-content {
              background: #fff;
              padding: 2em;
              border-radius: 8px;
              max-height: 80vh;
              overflow-y: auto;
              max-width: 600px;
              width: 90%;
            }
            #modal-content h2 {
              margin-top: 0;
            }
            #modal-content ul {
              padding-left: 1em;
            }
            #modal-content li {
              margin-bottom: 1em;
            }
            #close {
              font-size: 150px;
              color: #ffffff;
              position: fixed;
              cursor: pointer;
              top: 0px;
              right: 50px;
            }
          </style>
        `;
    }
  
    static get html() { 
        return `
        <div id="container">
          <div id="card">
          <img src="${componentPath}/images/loading.svg">
          </div>
          <div id="modal">
          <span id="close">&times;</span>
            <div id="modal-content">
              Foo.
            </div>
          </div>
        </div>
        `;
    }
 
    static get observedAttributes() { 
        return [...super.baseObservedAttributes, 
            'feed'];
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
  
    initialize() {
        this.container = this.shadowRoot.querySelector('#container');
        this.card = this.shadowRoot.querySelector("#card");
        this.modal = this.shadowRoot.querySelector("#modal");
        this.close = this.shadowRoot.querySelector("#close");
        this.signals = [];
    }
    
    connectedCallback() {
        this.setup();
        this.feed = this.getAttribute('feed');
        if (this.feed) this.loadFeed(this.feed);
    }
    
    disconnectedCallback() {
        this.teardown();
    }
    
    setup = () => {
       // this.observedMessages = [`${this.id}`];
       // this.subscribe(this.observedMessages);
        this.subscribe(this.signals); 
        this.card.addEventListener("click", () =>  this.modal.classList.add("active"));
        this.close.addEventListener("click", () =>  this.modal.classList.remove("active"));
        this.modal.addEventListener("click", e => {
            if (e.target === modal) modal.classList.remove("active");
        }); 
    }


    teardown = () => {
        this.unsubscribe(this.signals);
    }
    
    loadFeed = async (url) => {
        try {
            const proxy = "https://api.allorigins.win/raw?url="; 
            const res = await fetch(proxy + encodeURIComponent(url));
            const text = await res.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, "application/xml");
            const channel = xml.querySelector("channel");
            const title = channel.querySelector("title")?.textContent ?? "Feed";
            const items = [...xml.querySelectorAll("item")].map(item => ({
                title: item.querySelector("title")?.textContent,
                link: item.querySelector("link")?.textContent,
                description: item.querySelector("description")?.textContent
            }));
            this.renderCard(title, items);
        } catch (err) {
            console.error("Error loading feed:", err);
            this.shadowRoot.innerHTML = `<p>Failed to load feed.</p>`;
        }
      }

    renderCard(feedTitle, items) {
        if (!items.length) {
            this.container.innerHTML = `<p>No items found.</p>`;
            return;
        }
        const first = items[0];

        this.card.innerHTML = `<h3>${feedTitle}</h3>
            <p><strong>${first.title}</strong></p>
            <p>${first.description?.substring(0,100) ?? ""}...</p>`;

        this.shadowRoot.querySelector("#modal-content").innerHTML = `
        <h2>${feedTitle}</h2>
              <ul>
                ${items.map(item =>
                  `<li>
                    <a href="${item.link}" target="_blank">${item.title}</a><br>
                    <small>${item.description ?? ""}</small>
                  </li>`).join("")}
              </ul>
        `;
    }

    attributeChangedCallback(name, oldValue, newValue) {
        // Call the parent's attributeChangedCallback to preserve its behavior
        super.attributeChangedCallback(name, oldValue, newValue);
       
    }
}
