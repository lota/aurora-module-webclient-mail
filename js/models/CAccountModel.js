'use strict';

var
	_ = require('underscore'),
	ko = require('knockout'),
	
	AddressUtils = require('%PathToCoreWebclientModule%/js/utils/Address.js'),
	TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js'),
	UrlUtils = require('%PathToCoreWebclientModule%/js/utils/Url.js'),
	Utils = require('%PathToCoreWebclientModule%/js/utils/Common.js'),
	
	Ajax = null,
	Api = require('%PathToCoreWebclientModule%/js/Api.js'),
	App = null,
	Browser = require('%PathToCoreWebclientModule%/js/Browser.js'),
	ModulesManager = require('%PathToCoreWebclientModule%/js/ModulesManager.js'),
	UserSettings = require('%PathToCoreWebclientModule%/js/Settings.js'),
	
	Popups = require('%PathToCoreWebclientModule%/js/Popups.js'),
	AlertPopup = require('%PathToCoreWebclientModule%/js/popups/AlertPopup.js'),
	ConfirmPopup = require('%PathToCoreWebclientModule%/js/popups/ConfirmPopup.js'),
	
	CFiltersModel = require('modules/%ModuleName%/js/models/CFiltersModel.js'),
	CServerModel = require('modules/%ModuleName%/js/models/CServerModel.js'),
	
	AccountList = null,
	Cache = null,
	Settings = require('modules/%ModuleName%/js/Settings.js')
;

/**
 * @constructor
 * @param {boolean} bSingle
 */
function CAccountModel(bSingle)
{
	this.id = ko.observable(0);
	this.email = ko.observable('');
	this.hash = ko.computed(function () {
		return Utils.getHash(this.id() + this.email());
	}, this);
	this.allowMail = ko.observable(true);
	this.passwordSpecified = ko.observable(true);
	
	this.serverId = ko.observable(0);
	this.oServer = new CServerModel();
	
	this.extensions = ko.observableArray([]);
	this.fetchers = ko.observable(null);
	this.identities = ko.observable(null);
	this.friendlyName = ko.observable('');
	this.incomingLogin = ko.observable('');
	this.bInternal = false; // If **true**, the account is hosted by bundled mailserver.
	this.isDefault = ko.observable(false);
	this.outgoingLogin = ko.observable('');
	this.isExtended = ko.observable(false);
	this.signature = ko.observable('');
	this.useSignature = ko.observable(false);
	this.autoresponder = ko.observable(null);
	this.forward = ko.observable(null);
	this.filters = ko.observable(null);

	this.quota = ko.observable(0);
	this.usedSpace = ko.observable(0);
	this.quotaRecieved = ko.observable(false);

	this.fullEmail = ko.computed(function () {
		return AddressUtils.getFullEmail(this.friendlyName(), this.email());
	}, this);
	
	this.isCurrent = ko.observable(false);
	this.isEdited = ko.observable(false);
	
	this.extensionsRequested = ko.observable(false);
	
	this.canBeRemoved = ko.computed(function () {
		return !this.bInternal && (!this.isDefault() || this.isDefault() && Settings.AllowChangeEmailSettings);
	}, this);
	
	this.removeHint = ko.computed(function () {
		var
			sAndOther = '',
			sHint = ''
		;
		
		if (this.isDefault())
		{
			if (ModulesManager.isModuleIncluded('CalendarWebclient') && ModulesManager.isModuleIncluded('ContactsWebclient'))
			{
				sAndOther = TextUtils.i18n('%MODULENAME%/INFO_REMOVE_ACCOUNT_CONTACTS_CALENDARS');
			}
			else if (ModulesManager.isModuleIncluded('CalendarWebclient'))
			{
				sAndOther = TextUtils.i18n('%MODULENAME%/INFO_REMOVE_ACCOUNT_CALENDARS');
			}
			else if (ModulesManager.isModuleIncluded('ContactsWebclient'))
			{
				sAndOther = TextUtils.i18n('%MODULENAME%/INFO_REMOVE_ACCOUNT_CONTACTS');
			}
			sHint = TextUtils.i18n('%MODULENAME%/INFO_REMOVE_DEFAULT_ACCOUNT', {'AND_OTHER': sAndOther});
			if (!bSingle)
			{
				sHint += TextUtils.i18n('%MODULENAME%/INFO_REMOVE_DEFAULT_ACCOUNT_NOTSINGLE');
			}
		}
		else
		{
			sHint = TextUtils.i18n('%MODULENAME%/INFO_REMOVE_ACCOUNT');
		}
		
		return sHint;
	}, this);
	
	this.removeConfirmation = ko.computed(function () {
		if (this.isDefault())
		{
			return this.removeHint() + TextUtils.i18n('%MODULENAME%/CONFIRM_REMOVE_ACCOUNTED');
		}
		else
		{
			return TextUtils.i18n('%MODULENAME%/CONFIRM_REMOVE_ACCOUNT');
		}
	}, this);
}

CAccountModel.prototype.requireAccounts = function ()
{
	if (AccountList === null)
	{
		AccountList = require('modules/%ModuleName%/js/AccountList.js');
	}
};

CAccountModel.prototype.requireApp = function ()
{
	if (App === null)
	{
		App = require('%PathToCoreWebclientModule%/js/App.js');
	}
};

CAccountModel.prototype.requireAjax = function ()
{
	if (Ajax === null)
	{
		Ajax = require('modules/%ModuleName%/js/Ajax.js');
	}
};

CAccountModel.prototype.requireCache = function ()
{
	if (Cache === null)
	{
		Cache = require('modules/%ModuleName%/js/Cache.js');
	}
};

/**
 * @param {number} iId
 * @param {string} sEmail
 * @param {string} sFriendlyName
 */
CAccountModel.prototype.init = function (iId, sEmail, sFriendlyName)
{
	this.id(iId);
	this.email(sEmail);
	this.friendlyName(sFriendlyName);
};

/**
 * @param {Object} oResult
 * @param {Object} oRequest
 */
CAccountModel.prototype.onGetQuotaResponse = function (oResult, oRequest)
{
	if (_.isArray(oResult.Result) && 1 < oResult.Result.length)
	{
		this.quota(Types.pInt(oResult.Result[1]));
		this.usedSpace(Types.pInt(oResult.Result[0]));
		
		this.requireCache();
		Cache.quotaChangeTrigger(!Cache.quotaChangeTrigger());
	}
	
	this.quotaRecieved(true);
};

CAccountModel.prototype.updateQuotaParams = function ()
{
	if (UserSettings.ShowQuotaBar && this.allowMail())
	{
		this.requireAjax();
		Ajax.send('GetQuota', { 'AccountID': this.id() }, this.onGetQuotaResponse, this);
	}
};

/**
 * @param {Object} oData
 */
CAccountModel.prototype.parse = function (oData)
{
	this.init(Types.pInt(oData.AccountID), Types.pString(oData.Email), Types.pString(oData.FriendlyName));
		
	this.allowMail(!!oData.AllowMail);

	this.passwordSpecified(!!oData.IsPasswordSpecified);
	this.useSignature(!!oData.UseSignature);
	this.signature(Types.pString(oData.Signature));

	this.isDefault(!!oData.IsDefault);
	this.isCurrent(!!oData.IsDefault);
	this.isEdited(!!oData.IsDefault);
};

CAccountModel.prototype.requestExtensions = function ()
{
	if (!this.extensionsRequested())
	{
		var oTz = window.jstz ? window.jstz.determine() : null;
		this.requireAjax();
		Ajax.send('GetExtensions', {
			'AccountID': this.id(),
			'ClientTimeZone': oTz ? oTz.name() : ''
		}, this.onGetExtensionsResponse, this);
	}
};

/**
 * @param {Object} oResult
 * @param {Object} oRequest
 */
CAccountModel.prototype.onGetExtensionsResponse = function (oResult, oRequest)
{
	var
		bResult = !!oResult.Result,
		aExtensions = bResult ? oResult.Result.Extensions : []
	;
	
	if (bResult)
	{
		this.setExtensions(aExtensions);
		this.extensionsRequested(true);
	}
};

/**
 * @param {Array} aExtensions
 */
CAccountModel.prototype.setExtensions = function(aExtensions)
{
	if (_.isArray(aExtensions))
	{
		this.extensions(aExtensions);
	}
};

/**
 * @param {string} sExtension
 * 
 * return {boolean}
 */
CAccountModel.prototype.extensionExists = function(sExtension)
{
	return (_.indexOf(this.extensions(), sExtension) === -1) ? false : true;
};

CAccountModel.prototype.allowMailAfterConfiguring = function ()
{
	if (!this.allowMail())
	{
		if (this.passwordSpecified())
		{
			Popups.showPopup(AlertPopup, [
				TextUtils.i18n('%MODULENAME%/INFO_AFTER_CONNECT_MAIL_HTML', {'EMAIL': this.email()}),
				null,
				TextUtils.i18n('%MODULENAME%/HEADING_AFTER_CONNECT_MAIL_HTML', {'EMAIL': this.email()})
			]);
		}
		
		this.allowMail(true);
		
		this.requireCache();
		Cache.getFolderList(this.id());
	}
};

/**
 * @param {?} ExtendedData
 */
CAccountModel.prototype.updateExtended = function (ExtendedData)
{
	if (ExtendedData)
	{
		this.isExtended(true);
		
		this.bInternal = !!ExtendedData.IsInternal;
		this.isDefault(!!ExtendedData.IsDefault);
		
		this.friendlyName(Types.pString(ExtendedData.FriendlyName));
		this.incomingLogin(Types.pString(ExtendedData.IncomingLogin));
		this.outgoingLogin(Types.pString(ExtendedData.OutgoingLogin));
		
		this.serverId(Types.pInt(ExtendedData.ServerId));
		this.oServer = new CServerModel(ExtendedData.Server);
		
		this.setExtensions(ExtendedData.Extensions || []);
	}
};

CAccountModel.prototype.changeAccount = function()
{
	this.requireAccounts();
	AccountList.changeCurrentAccount(this.id(), true);
};

CAccountModel.prototype.getDefaultIdentity = function()
{
	return _.find(this.identities() || [], function (oIdentity) {
		return oIdentity.isDefault();
	});
};

/**
 * @returns {Array}
 */
CAccountModel.prototype.getFetchersIdentitiesEmails = function()
{
	var
		aFetchers = this.fetchers() ? this.fetchers().collection() : [],
		aIdentities = this.identities() || [],
		aEmails = []
	;
	
	_.each(aFetchers, function (oFetcher) {
		aEmails.push(oFetcher.email());
	});
	
	_.each(aIdentities, function (oIdentity) {
		aEmails.push(oIdentity.email());
	});
	
	return aEmails;
};

/**
 * Shows popup to confirm removing if it can be removed.
 * 
 * @param {Function} fAfterRemoveHandler This function should be executed after removing the account.
 */
CAccountModel.prototype.remove = function(fAfterRemoveHandler)
{
	var fCallBack = _.bind(this.confirmedRemove, this);
	
	if (this.canBeRemoved())
	{
		this.fAfterRemoveHandler = fAfterRemoveHandler;
		Popups.showPopup(ConfirmPopup, [this.removeConfirmation(), fCallBack, this.email()]);
	}
};

/**
 * Sends a request to the server for deletion account if received confirmation from the user.
 * 
 * @param {boolean} bOkAnswer
 */
CAccountModel.prototype.confirmedRemove = function(bOkAnswer)
{
	if (bOkAnswer)
	{
		this.requireAjax();
		Ajax.send('DeleteAccount', { 'AccountIDToDelete': this.id() }, this.onAccountDeleteResponse, this);
	}
	else
	{
		this.fAfterRemoveHandler = undefined;
	}
};

/**
 * Receives response from the server and removes account from js-application if removal operation on the server was successful.
 * 
 * @param {Object} oResponse Response obtained from the server.
 * @param {Object} oRequest Parameters has been transferred to the server.
 */
CAccountModel.prototype.onAccountDeleteResponse = function (oResponse, oRequest)
{
	if (!oResponse.Result)
	{
		Api.showErrorByCode(oResponse, TextUtils.i18n('%MODULENAME%/ERROR_REMOVE_ACCOUNT'));
	}
	else
	{
		if (!App.isMobile() && !App.isNewTab())
		{
			var PopupComposeUtils = require('modules/%ModuleName%/js/utils/PopupCompose.js');
			PopupComposeUtils.closeComposePopup();
		}
		
		this.requireAccounts();
		AccountList.deleteAccount(this.id());
		
		if (this.isDefault())
		{
			UrlUtils.clearAndReloadLocation(Browser.ie8AndBelow, true);
		}
		else if (typeof this.fAfterRemoveHandler === 'function')
		{
			this.fAfterRemoveHandler();
			this.fAfterRemoveHandler = undefined;
		}
	}
};

CAccountModel.prototype.requestFilters = function ()
{
	Ajax.send('GetFilters', { 'AccountID': this.id() }, this.onGetFiltersResponse, this);
};

/**
 * @param {Object} oResponse
 * @param {Object} oRequest
 */
CAccountModel.prototype.onGetFiltersResponse = function (oResponse, oRequest)
{
	var oFilters = new CFiltersModel();
	if (oResponse.Result)
	{
		oFilters.parse(this.id(), oResponse.Result);
	}
	this.filters(oFilters);
};

module.exports = CAccountModel;
