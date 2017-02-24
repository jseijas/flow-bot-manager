import { FlowStorage } from 'flow-storage';
import FlowTemplate from 'flow-template';
import builder from 'botbuilder';
import { FlowRenderFactory } from 'flow-render-factory';
import path from 'path';
import FlowRequireManager from 'flow-require-manager';

class BotManager {
  constructor(settings) {
    this.settings = settings || {};
    this.observers = {};
    this.createStorage();
    this.createTemplate();
    this.createConnector();
    this.createBot();
    this.createObservers();
    this.createRenderFactory();
    this.cardManager = new FlowRequireManager({ logger: settings.logger, pattern: '*.json' });
    this.actionManager = new FlowRequireManager({ logger: settings.logger, pattern: '*.js' });
    this.dialogManager = new FlowRequireManager({ logger: settings.logger, pattern: '*.flow' });
    this.createCards(function(err) {
      if (err) {
        this.log('error', err);
      }
      this.log('now will load actions');
      this.createActions(function(err) {
        if (err) {
          this.log('error', err);
        }
        this.createDialogs(function(err) {
          if (err) {
            this.log('error', err);
          }
          this.buildDialogs();
        }.bind(this));
      }.bind(this));
    }.bind(this));
  }

  log(level, message) {
    if (this.settings.logger) {
      this.settings.logger.log(level, message);
    }
  }

  createStorage() {
    this.storage = this.settings.storage || new FlowStorage();
    delete this.settings['storage'];
  }

  createTemplate() {
    if (!this.settings.template) {
      let opts = {
        localesPath: this.settings.localesPath,
        defaultLocale: this.settings.defaultLocale
      };
      this.settings.template = new FlowTemplate(opts);
    }
    this.template = this.settings.template;
    delete this.settings['template'];
  }

  createConnector() {
    if (this.settings.connector) {
      return this.connector = this.settings.connector;
    }
    let botAppId = this.settings.botAppId || process.env.BOT_APP_ID;
    let pass = this.settings.botAppPassword || process.env.BOT_APP_PASSWORD;
    this.connector = new builder.ChatConnector({
      appId: botAppId,
      appPassword: pass
    });
  }

  createBot() {
    this.bot = new builder.UniversalBot(this.connector);
  }

  observeEvent(name, message) {
    if (this.observers[name]) {
      for (let observer in this.observers[name]) {
        observer(message);
      }
    }
  }

  createObservers() {
    let eventNames = ['contactRelationUpdate', 'deleteUserData', 'message', 'ping', 'typing', 'conversationUpdate'];
    for (let eventName in eventNames) {
      this.bot.on(eventName, this.observeEvent.bind(this,eventName));
    }
  }

  createRenderFactory() {
    this.renderFactory = new FlowRenderFactory({ template: this.template, builder: builder });
  }

  getAbsolutePath(relative) {
    return path.normalize(path.join(process.cwd(),relative));
  }

  createCards(cb) {
    this.log('info', 'Loading cards from folder');
    if (this.settings.cardPath) {
      this.log('info', `Loading card from folder ${this.settings.cardPath}`);
      this.cardManager.addFolder(this.settings.cardPath, cb);
    } else {
      this.log('info', 'No card folder defined');
      cb();
    }
  }

  createActions(cb) {
    this.log('info', 'Loading actions from folder');
    if (this.settings.actionPath) {
      this.log('info', `Loading action from folder ${this.settings.actionPath}`);
      this.actionManager.addFolder(this.settings.actionPath, cb);
    } else {
      this.log('info', 'No action folder defined');
      cb();
    }
  }

  createDialogs(cb) {
    this.log('info', 'Loading dialogs from folder');
    if (this.settings.dialogPath) {
      this.log('info', `Loading dialogs from folder ${this.settings.dialogPath}`);
      this.dialogManager.addFolder(this.settings.dialogPath, cb);
    } else {
      this.log('info', 'No dialog folder defined');
      cb();
    }
  }

  parseFlow(str) {
    let lines = str.text.split('\n');
    let result = [];
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (line === '') {
        continue;
      }
      let item = {};
      let tokens = line.split('->');
      item.name = tokens[0].trim();
      item.flow = [];
      if (tokens.length === 1) {
        let cardName = tokens[0].substring(1).trim();
        if (cardName === '') {
          cardName = 'root';
        }
        item.flow.push(cardName);
      } else {
        tokens = tokens[1].split(',');
        for (let j = 0; j < tokens.length; j++) {
          item.flow.push(tokens[j].trim());
        }
      }
      result.push(item);
    }
    return result;
  }

  buildItemDialog(item) {
    let actionArr = [];
    actionArr.push(this.getVariables.bind(this));
    for (let i = 0; i < item.flow.length; i++) {
      let current = item.flow[i].trim();
      if (current !== '') {
        if (current[0] === '/') {
          actionArr.push(this.beginDialog.bind(this, current));
        } else if (current.endsWith('()')) {
          current = current.substring(0, current.length-2);
          let action = this.actionManager.getItem(current);
          actionArr.push(action.method.bind(this));
        } else {
          actionArr.push(this.sendCard.bind(this, current));
        }
      }
    }
    actionArr.push(this.endDialog.bind(this));
    let finalName = item.name === 'root' ? '/' : item.name;
    if (!finalName.startsWith('/')) {
      finalName = '/'+finalName;
    }
    this.bot.dialog(finalName, actionArr);
    this.log('info', `Built dialog ${finalName}`);
  }

  buildDialogs() {
    this.log('info', 'building dialogs');
    for (let name in this.dialogManager.items) {
      let item = this.dialogManager.items[name];
      if (item.flow) {
        item.name = name;
        this.buildItemDialog(item);
      }
      else {
        let items = this.parseFlow(item);
        for (let i = 0; i < items.length; i++) {
          this.buildItemDialog(items[i]);
        }
      }
    }    
  }

  addObserver(eventName, fn) {
    if (!this.observers[eventName]) {
      this.observers[eventName] = [];
    }
    this.observers[eventName].push(fn);
  }

  getVariables(session, args, next) {
    this.storage.getAllFromCollection('user', session.message.address.user.id, function(err, values) {
      session.view = {};
      session.view.user = values;
      next();
    });
  }

  sendCard(name, session, args, next) {
    let card = this.cardManager.getItem(name);
    let locale = 'en';
    if (session.view && session.view.user && session.view.user.locale) {
      locale = session.view.user.locale;
    }
    card = this.renderFactory.render(session, card, locale, session.view);
    session.send(card);
    next();
  }

  endDialog(session, args, next) {
    session.endDialog();
  }

  beginDialog(name, session, args, next) {
    session.beginDialog(name);
  }

}

export default BotManager;
