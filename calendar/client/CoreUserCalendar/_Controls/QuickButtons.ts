import {Control, IControlOptions, TemplateFunction} from 'UI/Base';
import {SyntheticEvent} from 'UICommon/Events';
import {dateToSql, TO_SQL_MODE} from 'Types/formatter';
import {Info} from 'EngineUser/Info';
import {Helper, IConfig, loadConfig} from 'CoreUserCalendar/common';
import template = require('wml!CoreUserCalendar/_Controls/QuickButtons');
import {SbisService, Query, DataSet} from 'Types/source';
import {RecordSet} from 'Types/collection';
import {error as dataSourceError} from 'Controls/dataSource';
import Store from 'Controls/Store';

interface IButtonConfig {
    name: string;
    iconName: string;
    iconStyle: string;
    buttonStyle: string;
    class?: string;
    doc_type: string;
    caption: string;
    tooltip: string;
}

interface IMenuItem {
    __id: string;
    items: IMenuItem[];
    title: string;
    icon: string;
    data: IMenuItemData;
}

interface IMenuItemData {
    handlerAction: string;
    handlerModule: string;
    Type: number;
    MainAuthPerson: boolean;
    reglament?: string;
}

const quickTypes = ['Отгул', 'Больничный', 'Отпуск'];
const defaultConfig: Record<string, IButtonConfig> = {
    Отгул: {
        name: 'time_off',
        iconName: 'icon-SelfVacation',
        iconStyle: 'wtm-custom',
        buttonStyle: 'success',
        caption: 'Отгул',
        tooltip: 'Создать отгул',
        doc_type: 'Отгул'
    },
    Отпуск: {
        name: 'vacation',
        iconName: 'icon-Vacation',
        iconStyle: 'wtm-custom',
        buttonStyle: 'success',
        caption: 'Отпуск',
        tooltip: 'Создать отпуск',
        doc_type: 'Отпуск'
    },
    Больничный: {
        name: 'hospital',
        iconName: 'icon-Sick',
        iconStyle: 'wtm-custom',
        buttonStyle: 'success',
        caption: 'Больничный',
        tooltip: 'Создать больничный',
        doc_type: 'Больничный'
    }
};

export default class QuickButtons extends Control<IControlOptions> {
    protected _template: TemplateFunction = template;
    protected _hasButtons: boolean = false;
    protected _buttons: IButtonConfig[];
    protected _isClientAuth: boolean = Helper.isClientAuth() ;
    protected _isMySbis: boolean = Helper.isMySbis();
    protected _person: number;
    protected _tab: string;
    private _errorController: dataSourceError.Controller = new dataSourceError.Controller({});
    private _callbackId: string;
    protected _children: {
        dayInfoOpener: Control
    };
    protected _buttonsConfig: IButtonConfig[] = [];

    protected _beforeMount(options: IControlOptions): Promise<IConfig | void> {
        if (!this._isMySbis) {
            this._person = options.personID || Info.get('ЧастноеЛицо');
            this._tab = options.tab;

            if (options.prefetchResult?.[0]?.get('documents_menu')) {
                const documentsMenu = options.prefetchResult[0].get('documents_menu');
                this._updateConfig(documentsMenu);
            } else {
                return this._fetchDocumentsMenu(options).then((documentsMenu: RecordSet) => {
                    this._updateConfig(documentsMenu);
                });
            }
        }
    }

    protected _beforeUnmount(): void {
        //
    }

    private _fetchDocumentsMenu(options: IControlOptions = this._options): Promise<RecordSet> {
        const menuSource = new SbisService({
            endpoint: 'WorkTimeManagement',
            binding: {
                query: 'DocumentsMenu'
            },
            keyProperty: 'id',
            nodeProperty: 'is_doc_type_root',
            parentProperty: 'parent'
        });
        const filter = {
            calendar: this._options.calendarUUID || null,
            date: dateToSql(new Date(), TO_SQL_MODE.DATE),
            onlyMain: false,
            person_id: this._person,
            source: 'calendar'
        };
        return menuSource.query(new Query().where(filter)).then((result: DataSet) => {
            return result.getAll();
        }).catch((error: Error) => {
            this._errorHandler(error);
            return null;
        });
    }

    private _updateConfig(menuResult: RecordSet): void {
        const typesSet: Set<string> = new Set();

        menuResult?.each((itemsRow) => {
            const docType = itemsRow.get('doc_type');
            if (quickTypes.includes(docType)) {
                typesSet.add(docType);
            }
        });
        this._buttonsConfig = Array.from(typesSet).map((item) => {
            return defaultConfig[item];
        });
        this._hasButtons = this._buttonsConfig.length ? true : false;

    }

    private _errorHandler(error: Error): Promise<unknown> {
        return this._errorController.process({
            error,
            mode: dataSourceError.Mode.dialog
        }).then((errorViewConfig) => {
            this._errorViewConfig = errorViewConfig;
            return error;
        });
    }

    /**
     * Отркывашка панели информации о дне в режиме создания документа
     * @param event
     * @param config
     * @protected
     */
    protected _openDayInfo(event: SyntheticEvent<MouseEvent>, config: IButtonConfig): void {
        const calendarCreateDate = Store.get('calendarCreateDate');
        this._children.dayInfoOpener.openDayInfo({
            person: this._person || Info.get('ЧастноеЛицо') as number || 0,
            preferCalendar: true,
            useAllPositions: true,
            positionsWithDoc: false,
            dialogViewMode: 'wide',
            showPerson: false,
            createDocument: {
                docType: config.doc_type
            },
            date: this._options.createDate || calendarCreateDate || new Date()
        }, this, null);
    }
}
