import {Control, TemplateFunction, IControlOptions} from 'UI/Base';
import template = require('wml!CoreUserCalendar/_Controls/EventVisibilityNotification');
import 'css!CoreUserCalendar/controls';

interface IOptions extends IControlOptions {
    handler?: Function;
}

export default class Notification extends Control<IOptions> {
    protected _template: TemplateFunction = template;

    protected _onClick(): void {
        this._options.handler();
        this._notify('close', [], { bubbling: true });
    }
}
