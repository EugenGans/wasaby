define(["require", "exports", "tslib", "UI/Base", "Controls/popup", "Controls/Store", "Types/source", "Env/Event", "Browser/Event"], function (require, exports, tslib_1, Base_1, popup_1, Store_1, source_1, Event_1, Event_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
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
    var EventCalendarMonitor = /** @class */ (function (_super) {
        tslib_1.__extends(EventCalendarMonitor, _super);
        function EventCalendarMonitor() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this._list = null;
            _this._onShowChangedBound = null;
            _this._onListChangedBound = null;
            _this._onEventChangedBound = null;
            return _this;
        }
        EventCalendarMonitor.prototype._beforeMount = function (options) {
            this._onShowChangedBound = this._onShowChanged.bind(this);
            this._onListChangedBound = this._onListChange.bind(this);
            this._onEventChangedBound = this._onEventChanged.bind(this);
        };
        EventCalendarMonitor.prototype._afterMount = function (options) {
            var _this = this;
            this._list = Store_1.default.get('masterCalendarList');
            this._callbackId = Store_1.default.onPropertyChanged('masterCalendarList', function (value) {
                _this._list = value;
            });
            Event_2.Server.serverChannel('calendar.setshowevents').subscribe('onMessage', this._onShowChangedBound);
            Event_2.Server.serverChannel('calendar.operation_on_calendar').subscribe('onMessage', this._onListChangedBound);
            Event_1.Bus.channel('CalendarEventCard').subscribe('updateSuccessed', this._onEventChangedBound);
            Event_1.Bus.channel('CalendarEventCard').subscribe('deleteSuccessed', this._onEventChangedBound);
        };
        EventCalendarMonitor.prototype._beforeUnmount = function () {
            Event_2.Server.serverChannel('calendar.setshowevents').unsubscribe('onMessage', this._onShowChangedBound);
            Event_2.Server.serverChannel('calendar.operation_on_calendar').unsubscribe('onMessage', this._onListChangedBound);
            Event_1.Bus.channel('CalendarEventCard').unsubscribe('updateSuccessed', this._onEventChangedBound);
            Event_1.Bus.channel('CalendarEventCard').unsubscribe('deleteSuccessed', this._onEventChangedBound);
            if (this._callbackId) {
                Store_1.default.unsubscribe(this._callbackId);
            }
            this._onShowChangedBound = null;
            this._onListChangedBound = null;
            this._onEventChangedBound = null;
        };
        // TODO: зачем это, если через секунду прилетит новый рекордсет из-за operation_on_calendar
        EventCalendarMonitor.prototype._onShowChanged = function (e, dataList) {
            var _this = this;
            if (dataList && dataList.forEach) {
                dataList.forEach(function (item) {
                    var rec = _this._list.getRecordById(item.get('@CalendarPermission'));
                    if (rec) {
                        rec.set('Show', item.get('Show'));
                    }
                });
            }
        };
        EventCalendarMonitor.prototype._onListChange = function (e, message) {
            this._notify('listChanged', [message]);
        };
        // нотификация о создании в отключенный календарь реагирует на событие с клиента (не с сервера - почему?)
        EventCalendarMonitor.prototype._onEventChanged = function (e, options) {
            var _a;
            var isNew = options.operation === 'create';
            var calendarUUIDs = options.record.get('СписокКалендарей');
            var calendarsToShow = [];
            var visibleMatch = false;
            // Определим какие календари включены и есть ли включенные уже
            (_a = this._list) === null || _a === void 0 ? void 0 : _a.each(function (rec) {
                var UUID = rec.get('CalendarUUID');
                var match = calendarUUIDs.indexOf(UUID) !== -1;
                if (match) {
                    if (rec.get('Show')) {
                        visibleMatch = true;
                    }
                    else {
                        calendarsToShow.push(rec);
                    }
                }
            });
            // на главной странице (включена опция wml) покажем уведомление, что событие создано в отключенный календарь
            if (isNew && this._options.visibilityNotification && calendarsToShow.length) {
                popup_1.Notification.openPopup({
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
        };
        // метод включает отключенные календари, по клику на уведомлении об их отключенности
        EventCalendarMonitor.prototype._showPermissions = function (perms) {
            var params = {};
            perms.forEach(function (perm) {
                params[perm.get('@CalendarPermission')] = true;
                perm.set('Show', true);
            });
            new source_1.SbisService({
                endpoint: {
                    address: '/service/',
                    contract: 'Calendar'
                }
            }).call('SetShowEvents', {
                Params: params
            });
        };
        return EventCalendarMonitor;
    }(Base_1.Control));
    exports.default = EventCalendarMonitor;
});
