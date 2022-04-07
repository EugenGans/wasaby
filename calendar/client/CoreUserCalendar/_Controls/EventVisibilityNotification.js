define(["require", "exports", "tslib", "UI/Base", "wml!CoreUserCalendar/_Controls/EventVisibilityNotification", "css!CoreUserCalendar/controls"], function (require, exports, tslib_1, Base_1, template) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Notification = /** @class */ (function (_super) {
        tslib_1.__extends(Notification, _super);
        function Notification() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this._template = template;
            return _this;
        }
        Notification.prototype._onClick = function () {
            this._options.handler();
            this._notify('close', [], { bubbling: true });
        };
        return Notification;
    }(Base_1.Control));
    exports.default = Notification;
});
