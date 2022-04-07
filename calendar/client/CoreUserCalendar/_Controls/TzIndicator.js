define(["require", "exports", "tslib", "UI/Base", "wml!CoreUserCalendar/_Controls/TzIndicator", "Env/Event", "CoreUserCalendar/common", "Env/Env", "css!CoreUserCalendar/controls"], function (require, exports, tslib_1, Base_1, template, Event_1, common_1, Env_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    /**
     * Индикатор таймзоны календаря в верхнем правом углу
     * @author Гусев Евгений Николаевич
     * @control
     * @public
     */
    var MSK_TZ = 180;
    var SIXTY = 60;
    // TODO: проверить для обоих кейсов - master должен передаваться в опциях
    var TzIndicator = /** @class */ (function (_super) {
        tslib_1.__extends(TzIndicator, _super);
        function TzIndicator() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this._template = template;
            // изменение настроек из панели Конфигурация-Интерфейс (только на странице Календарь)
            _this._settingsChanged = function (ev, settings) {
                // const changedFields = settings.getChanged();
                var timeZoneOffset = settings.get('timeZoneOffset');
                if (timeZoneOffset !== _this._settingsUTC && _this._master) {
                    if (typeof timeZoneOffset === 'number') {
                        _this._settingsUTC = timeZoneOffset;
                    }
                    else {
                        _this._settingsUTC = null;
                    }
                    _this._updateState();
                }
            };
            return _this;
        }
        TzIndicator.prototype._beforeMount = function (options, context, receivedState) {
            var _this = this;
            var _a;
            this._master = options.master;
            if (typeof options.utcOffset === 'number') {
                this._updateState(options);
            }
            else if (options.prefetchResult && options.prefetchResult[0] && options.prefetchResult[0].get) {
                var cfg = options.prefetchResult[0];
                this._settingsUTC = (_a = cfg.get('settings')) === null || _a === void 0 ? void 0 : _a.get('timeZoneOffset');
                this._departmentUTC = cfg.get('department_tz');
                this._addressUTC = typeof cfg.get('address_tz') === 'number' ? cfg.get('address_tz') + MSK_TZ : null;
                this._updateState(options);
            }
            else {
                return common_1.loadConfig(options).then(function (cfg) {
                    var _a;
                    _this._settingsUTC = (_a = cfg.get('settings')) === null || _a === void 0 ? void 0 : _a.get('timeZoneOffset');
                    _this._departmentUTC = cfg.get('department_tz');
                    _this._addressUTC = typeof cfg.get('address_tz') === 'number' ? cfg.get('address_tz') + MSK_TZ : null;
                    _this._updateState(options);
                    return cfg;
                });
            }
        };
        TzIndicator.prototype._afterMount = function () {
            Event_1.Bus.channel('ViewSettingsChannel').subscribe('onCalendarChange', this._settingsChanged);
        };
        TzIndicator.prototype._beforeUnmount = function () {
            Event_1.Bus.channel('ViewSettingsChannel').unsubscribe('onCalendarChange', this._settingsChanged);
        };
        TzIndicator.prototype._updateState = function (options) {
            if (options === void 0) { options = this._options; }
            var _a, _b, _c, _d;
            var cookieTz = Env_1.cookie.get('tz');
            var currentTZ = (typeof window === 'undefined' && cookieTz) ? -parseInt(cookieTz, 10) :
                -new Date().getTimezoneOffset();
            var personTZ = (_b = (_a = this._departmentUTC, (_a !== null && _a !== void 0 ? _a : this._addressUTC)), (_b !== null && _b !== void 0 ? _b : MSK_TZ));
            var calendarTZ = (_c = options.utcOffset, (_c !== null && _c !== void 0 ? _c : (this._master ? (_d = this._settingsUTC, (_d !== null && _d !== void 0 ? _d : personTZ)) : personTZ)));
            var datumPoint = 'MSK';
            var datumOffset = MSK_TZ;
            function getTime(min) {
                return !min ? '' :
                    (min > 0 ? '+' : '-') +
                        Math.floor(Math.abs(min) / SIXTY) +
                        (Math.abs(min) % SIXTY ? ':' + (Math.abs(min) % SIXTY) : '');
            }
            if (calendarTZ !== currentTZ) {
                this._tzDiffHours = getTime(calendarTZ - currentTZ);
                this._tzName = datumPoint + getTime(calendarTZ - datumOffset);
            }
            else {
                this._tzDiffHours = null;
                this._tzName = null;
            }
        };
        return TzIndicator;
    }(Base_1.Control));
    exports.default = TzIndicator;
});
