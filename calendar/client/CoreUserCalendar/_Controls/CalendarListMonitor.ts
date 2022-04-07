/**
 * компонент для мониторинга серверных событий в календарях
 * @class CoreUserCalendar.controls:CalendarListMonitor
 * @extends Control
 * @control
 * @public
 */

import {Control, IControlOptions} from 'UI/Base';
import {Record} from 'Types/entity';
import {Channel} from 'Env/Event';
import * as BrowserEvent from 'Browser/Event';
import { SyntheticEvent } from 'UICommon/Events';

export default class CalendarListMonitor extends Control<IControlOptions> {
    private _calendarToggleEventBus: Channel = null;
    private _onToggleServerEventBound: Function = this._onToggleServerEvent.bind(this);

    protected _afterMount(options?: IControlOptions): void {

        this._calendarToggleEventBus = BrowserEvent.Server.serverChannel('calendar.operation_on_calendar');
        this._calendarToggleEventBus.subscribe('onMessage', this._onToggleServerEventBound);
    }

    private _onToggleServerEvent(e: SyntheticEvent<Event>, recordList: Record[]): void {
        if (!recordList) {
            return;
        }
        this._notify('listChanged', [recordList], {bubbling: true});
    }

    protected _beforeUnmount(): void {
        this._calendarToggleEventBus.unsubscribe('onMessage', this._onToggleServerEventBound);
        this._onToggleServerEventBound = null;
    }
}
