import {Control, IControlOptions, TemplateFunction} from 'UI/Base';
import * as template from 'wml!CoreUserCalendar/_Controls/TzIndicator';
import 'css!CoreUserCalendar/controls';
import {Model} from 'Types/entity';
import {Bus} from 'Env/Event';
import { SyntheticEvent } from 'UICommon/Events';
import {loadConfig, IConfig} from 'CoreUserCalendar/common';
import {cookie} from 'Env/Env';

/**
 * Индикатор таймзоны календаря в верхнем правом углу
 * @author Гусев Евгений Николаевич
 * @control
 * @public
 */

const MSK_TZ = 180;
const SIXTY = 60;

interface IOptions extends IControlOptions {
    master: boolean;
    utcOffset: number;
    personUUID: string;
    personID: number;
}

// TODO: проверить для обоих кейсов - master должен передаваться в опциях
export default class TzIndicator extends Control<IOptions, IConfig> {
    protected _template: TemplateFunction = template;
    protected _tzDiffHours: string;
    protected _tzName: string;
    private _master: boolean;
    private _settingsUTC: number;
    private _departmentUTC: number;
    private _addressUTC: number;

    protected _beforeMount(options?: IOptions,
                           context?: object,
                           receivedState?: Model): void | Promise<Model> {

        this._master = options.master;
        if (typeof options.utcOffset === 'number') {
            this._updateState(options);
        } else if (options.prefetchResult && options.prefetchResult[0] && options.prefetchResult[0].get) {
            const cfg = options.prefetchResult[0];
            this._settingsUTC = cfg.get('settings')?.get('timeZoneOffset');
            this._departmentUTC = cfg.get('department_tz');
            this._addressUTC = typeof cfg.get('address_tz') === 'number' ? cfg.get('address_tz') + MSK_TZ : null;
            this._updateState(options);
        } else {
            return loadConfig(options).then((cfg: Model) => {
                this._settingsUTC = cfg.get('settings')?.get('timeZoneOffset');
                this._departmentUTC = cfg.get('department_tz');
                this._addressUTC = typeof cfg.get('address_tz') === 'number' ? cfg.get('address_tz') + MSK_TZ : null;
                this._updateState(options);
                return cfg;
            });
        }
    }

    protected _afterMount(): void {
        Bus.channel('ViewSettingsChannel').subscribe('onCalendarChange', this._settingsChanged);
    }

    protected _beforeUnmount(): void {
        Bus.channel('ViewSettingsChannel').unsubscribe('onCalendarChange', this._settingsChanged);
    }

    private _updateState(options: IOptions = this._options): void {
        const cookieTz = cookie.get('tz');
        const currentTZ = (typeof window === 'undefined' && cookieTz) ? -parseInt(cookieTz, 10) :
            -new Date().getTimezoneOffset();
        const personTZ = this._departmentUTC ?? this._addressUTC ?? MSK_TZ;
        const calendarTZ = options.utcOffset ?? (this._master ? this._settingsUTC ?? personTZ : personTZ);
        const datumPoint = 'MSK';
        const datumOffset = MSK_TZ;

        function getTime(min: number): string {
            return !min ? '' :
                (min > 0 ? '+' : '-') +
                Math.floor(Math.abs(min) / SIXTY) +
                (Math.abs(min) % SIXTY ? ':' + (Math.abs(min) % SIXTY) : '');
        }

        if (calendarTZ !== currentTZ) {
            this._tzDiffHours = getTime(calendarTZ - currentTZ);
            this._tzName = datumPoint + getTime(calendarTZ - datumOffset);
        } else {
            this._tzDiffHours = null;
            this._tzName = null;
        }
    }

    // изменение настроек из панели Конфигурация-Интерфейс (только на странице Календарь)
    private _settingsChanged: Function = (ev: SyntheticEvent<Event>, settings: Model): void => {
        // const changedFields = settings.getChanged();
        const timeZoneOffset = settings.get('timeZoneOffset');

        if (timeZoneOffset !== this._settingsUTC && this._master) {
            if (typeof timeZoneOffset === 'number') {
                this._settingsUTC = timeZoneOffset;
            } else {
                this._settingsUTC = null;
            }
            this._updateState();
        }
    }
}
