import {Control, TemplateFunction } from 'UI/Base';
import _template = require('wml!CoreUserCalendar/_Controls/HomeButton');

export default class HomeButton extends Control {
    protected _template: TemplateFunction = _template;

    protected _onClick(): void {
        this._notify('dateChanged', [new Date()], { bubbling: true});
    }
}
