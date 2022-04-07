define(["require", "exports", "tslib", "UI/Base", "Types/formatter", "wml!CoreUserCalendar/_Controls/DatePicker"], function (require, exports, tslib_1, Base_1, formatter_1, template) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var DatePicker = /** @class */ (function (_super) {
        tslib_1.__extends(DatePicker, _super);
        function DatePicker() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this._template = template;
            _this._weekCaptionFormatter = function (startDate) {
                return formatter_1.date(startDate, formatter_1.date.FULL_MONTH);
            };
            _this._liteCaptionFormatter = function (startDate) {
                return formatter_1.date(startDate, (['month', 'timesheet'].includes(_this._options.pickerMode)) ? 'MMMM\'YY' : 'YYYY');
            };
            return _this;
        }
        DatePicker.prototype._beforeMount = function (options) {
            this._ranges = {
                days: [options.range]
            };
        };
        // если не обновлять endDate, то между режимами year/month не будет обновляться caption
        DatePicker.prototype._beforeUpdate = function (options) {
            this._ranges = {
                days: [options.range]
            };
        };
        DatePicker.prototype._onRangeChanged = function (event, begin, end) {
            this._notify('dateChanged', [begin], { bubbling: true });
        };
        return DatePicker;
    }(Base_1.Control));
    exports.default = DatePicker;
});
