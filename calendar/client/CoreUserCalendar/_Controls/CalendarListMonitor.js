/**
 * компонент для мониторинга серверных событий в календарях
 * @class CoreUserCalendar.controls:CalendarListMonitor
 * @extends Control
 * @author Бирюков Виталий Валерьевич
 * @control
 * @public
 */
define(["require", "exports", "tslib", "UI/Base", "Browser/Event"], function (require, exports, tslib_1, Base_1, BrowserEvent) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var CalendarListMonitor = /** @class */ (function (_super) {
        tslib_1.__extends(CalendarListMonitor, _super);
        function CalendarListMonitor() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this._calendarToggleEventBus = null;
            _this._onToggleServerEventBound = _this._onToggleServerEvent.bind(_this);
            return _this;
        }
        CalendarListMonitor.prototype._afterMount = function (options) {
            this._calendarToggleEventBus = BrowserEvent.Server.serverChannel('calendar.operation_on_calendar');
            this._calendarToggleEventBus.subscribe('onMessage', this._onToggleServerEventBound);
        };
        CalendarListMonitor.prototype._onToggleServerEvent = function (e, recordList) {
            if (!recordList) {
                return;
            }
            this._notify('listChanged', [recordList], { bubbling: true });
        };
        CalendarListMonitor.prototype._beforeUnmount = function () {
            this._calendarToggleEventBus.unsubscribe('onMessage', this._onToggleServerEventBound);
            this._onToggleServerEventBound = null;
        };
        return CalendarListMonitor;
    }(Base_1.Control));
    exports.default = CalendarListMonitor;
});
