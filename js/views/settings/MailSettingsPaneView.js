'use strict';

var
	_ = require('underscore'),
	ko = require('knockout'),
	
	Browser = require('modules/CoreClient/js/Browser.js'),
	ModulesManager = require('modules/CoreClient/js/ModulesManager.js'),
	UserSettings = require('modules/CoreClient/js/Settings.js'),
	CAbstractSettingsFormView = ModulesManager.run('SettingsClient', 'getAbstractSettingsFormViewClass'),
	SettingsUtils = ModulesManager.run('SettingsClient', 'getSettingsUtils'),
	
	MailUtils = require('modules/%ModuleName%/js/utils/Mail.js'),
	Settings = require('modules/%ModuleName%/js/Settings.js')
;

/**
 * @constructor
 */
function CMailSettingsPaneView()
{
	CAbstractSettingsFormView.call(this, Settings.ServerModuleName);

	this.bRtl = UserSettings.IsRTL;
	this.bAllowThreads = Settings.AllowThreads;
	this.bAllowMailto = Settings.AllowAppRegisterMailto && (Browser.firefox || Browser.chrome);
	
	this.messagesPerPageValues = ko.observableArray(SettingsUtils.getAdaptedPerPageList(Settings.MailsPerPage));
	
	this.messagesPerPage = ko.observable(Settings.MailsPerPage);
	this.useThreads = ko.observable(Settings.useThreads());
	this.saveRepliesToCurrFolder = ko.observable(Settings.SaveRepliesToCurrFolder);
	this.allowChangeInputDirection = ko.observable(Settings.AllowChangeInputDirection);
}

_.extendOwn(CMailSettingsPaneView.prototype, CAbstractSettingsFormView.prototype);

CMailSettingsPaneView.prototype.ViewTemplate = '%ModuleName%_Settings_MailSettingsPaneView';

CMailSettingsPaneView.prototype.registerMailto = function ()
{
	MailUtils.registerMailto();
};

CMailSettingsPaneView.prototype.getCurrentValues = function ()
{
	return [
		this.messagesPerPage(),
		this.useThreads(),
		this.saveRepliesToCurrFolder(),
		this.allowChangeInputDirection()
	];
};

CMailSettingsPaneView.prototype.revertGlobalValues = function ()
{
	this.messagesPerPage(Settings.MailsPerPage);
	this.useThreads(Settings.useThreads());
	this.saveRepliesToCurrFolder(Settings.SaveRepliesToCurrFolder);
	this.allowChangeInputDirection(Settings.AllowChangeInputDirection);
};

CMailSettingsPaneView.prototype.getParametersForSave = function ()
{
	return {
		'MessagesPerPage': this.messagesPerPage(),
		'UseThreads': this.useThreads(),
		'SaveRepliesToCurrFolder': this.saveRepliesToCurrFolder(),
		'AllowChangeInputDirection': this.allowChangeInputDirection()
	};
};

CMailSettingsPaneView.prototype.applySavedValues = function (oParameters)
{
	Settings.update(oParameters.MessagesPerPage, oParameters.UseThreads, oParameters.SaveRepliesToCurrFolder, oParameters.AllowChangeInputDirection);
};

module.exports = new CMailSettingsPaneView();
