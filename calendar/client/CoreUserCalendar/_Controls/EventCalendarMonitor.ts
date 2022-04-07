import {Control, IControlOptions} from 'UI/Base';
import {Notification} from 'Controls/popup';
import Store from 'Controls/Store';
import {Model, Record} from 'Types/entity';
import {RecordSet} from 'Types/collection';
import {SbisService} from 'Types/source';
import { SyntheticEvent } from 'UICommon/Events';
import {Bus} from 'Env/Event';
import {Server} from 'Browser/Event';

/**
 * Невизуальный компонент который следит (мониторит через подписки):
 * 1 - за изменениями списка календарей текущего пользователя с сервера
 * - сообщает об этом через listChanged (чтобы обновить данные в сетке календаря)
 * - актуально только для основного календаря текущего пользователя
 * 2 - за сохранением карточки события на клиенте
 * - работает только в связке с CalendarPickerLink - от которого получает список календарей (чтбоы не запрашивать самому повторно)
 * - на основании этого списка включенных календарей:
 * - 1 - сообщает о сохранении события в отображаемом календаре через eventChanged (для оптимистичного отображения)
 * - 2 - если событие создано в отключенный календарь, то показывает уведомление об этом
 * @class CoreUserCalendar/base:Stack
 * @extends Control
 * @author Gusev EN
 * @control
 * @public
 */
export default class EventCalendarMonitor extends Control<IControlOptions> {
    private _list: RecordSet = null;
    private _callbackId: string;
    private _onShowChangedBound: Function = null;
    private _onListChangedBound: Function = null;
    private _onEventChangedBound: Function = null;

    protected _beforeMount(options: IControlOptions): void {
        this._onShowChangedBound = this._onShowChanged.bind(this);
        this._onListChangedBound = this._onListChange.bind(this);
        this._onEventChangedBound = this._onEventChanged.bind(this);
    }

    protected _afterMount(options: IControlOptions): void {
        this._list = Store.get('masterCalendarList') as RecordSet;
        this._callbackId = Store.onPropertyChanged('masterCalendarList', (value: RecordSet) => {
            this._list = value;
        });

        Server.serverChannel('calendar.setshowevents').subscribe('onMessage', this._onShowChangedBound);
        Server.serverChannel('calendar.operation_on_calendar').subscribe('onMessage', this._onListChangedBound);
        Bus.channel('CalendarEventCard').subscribe('updateSuccessed',  this._onEventChangedBound);
        Bus.channel('CalendarEventCard').subscribe('deleteSuccessed',  this._onEventChangedBound);
    }

    protected _beforeUnmount(): void {
        Server.serverChannel('calendar.setshowevents').unsubscribe('onMessage', this._onShowChangedBound);
        Server.serverChannel('calendar.operation_on_calendar').unsubscribe('onMessage', this._onListChangedBound);
        Bus.channel('CalendarEventCard').unsubscribe('updateSuccessed',  this._onEventChangedBound);
        Bus.channel('CalendarEventCard').unsubscribe('deleteSuccessed',  this._onEventChangedBound);
        if (this._callbackId) {
            Store.unsubscribe(this._callbackId);
        }
        this._onShowChangedBound = null;
        this._onListChangedBound = null;
        this._onEventChangedBound = null;
    }

    // TODO: зачем это, если через секунду прилетит новый рекордсет из-за operation_on_calendar
    private _onShowChanged(e: SyntheticEvent<Event>, dataList: Record[]): void {
        if (dataList && dataList.forEach) {
            dataList.forEach((item) => {
                const rec = this._list.getRecordById(item.get('@CalendarPermission'));
                if (rec) {
                    rec.set('Show', item.get('Show'));
                }
            });
        }
    }

    private _onListChange(e: SyntheticEvent<Event>, message: Record): void {
        this._notify('listChanged', [message]);
    }

    // нотификация о создании в отключенный календарь реагирует на событие с клиента (не с сервера - почему?)
    private _onEventChanged(e: SyntheticEvent<Event>, options: object): void {
        const isNew = options.operation === 'create';
        const calendarUUIDs = options.record.get('СписокКалендарей');
        const calendarsToShow = [];
        let visibleMatch = false;

        // Определим какие календари включены и есть ли включенные уже
        this._list?.each((rec) => {
            const UUID = rec.get('CalendarUUID');
            const match = calendarUUIDs.indexOf(UUID) !== -1;

            if (match) {
                if (rec.get('Show')) {
                    visibleMatch = true;
                } else {
                    calendarsToShow.push(rec);
                }
            }
        });
        // на главной странице (включена опция wml) покажем уведомление, что событие создано в отключенный календарь
        if (isNew && this._options.visibilityNotification && calendarsToShow.length) {
            Notification.openPopup({
                autoClose: true,
                template: 'CoreUserCalendar/controls:EventVisibilityNotification',
                templateOptions: {
                    handler: this._showPermissions.bind(this, calendarsToShow)
                }
            });
        }

        // ДРУГОЕ действие (если календарь включен) - уведомляем подписанныЕ календарь для Оптимистичного отображения
        if (visibleMatch) {
            this._notify('eventChanged', [options]);
        }
    }

    // метод включает отключенные календари, по клику на уведомлении об их отключенности
    private _showPermissions(perms: Model[]): void {
        const params = {};

        perms.forEach((perm: Model) => {
            params[perm.get('@CalendarPermission')] = true;
            perm.set('Show', true);
        });

        new SbisService({
            endpoint: {
                address: '/service/',
                contract: 'Calendar'
            }
        }).call('SetShowEvents', {
            Params: params
        });
    }
}
