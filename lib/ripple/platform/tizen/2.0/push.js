/*
 *  Copyright 2013 Intel Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var event = require('ripple/event'),
    errorcode = require('ripple/platform/tizen/2.0/errorcode'),
    t = require('ripple/platform/tizen/2.0/typecast'),
    Notification = require('ripple/platform/tizen/2.0/notification'),
    StatusNotification = require('ripple/platform/tizen/2.0/StatusNotification'),
    WebAPIError = require('ripple/platform/tizen/2.0/WebAPIError'),
    WebAPIException = require('ripple/platform/tizen/2.0/WebAPIException'),
    PushMessage,
    _data = {
        service: {
/*          "ID_APPLICATION_0": {
 *              appId:          null,
 *              registrationId: null,
 *              appControl:     null,
 *              isRegistered:   false,
 *              isConnected:    false,
 *              onpushed:       null
 *          }
 */
        }
    },
    _security = {
        "http://tizen.org/privilege/push": ["registerService",
            "unregisterService", "connectService", "disconnectService",
            "getRegistrationId"]
    },
    _self;

function _initialize() {
    event.on("PushNotified", function (appId, pushMessage) {
        var appService, notificationDict, statusNotification, notification;

        appService = _data.service[appId];

        if (!appService)
            return;

        if (appService.isConnected) {
            appService.onpushed(new PushMessage(pushMessage));
        } else {
            notificationDict = {
                content: pushMessage.appData,
                appControl: appService.appControl,
                appId: appId
            };
            statusNotification = new StatusNotification("SIMPLE",
                pushMessage.alertMessage, notificationDict);
            notification = new Notification();

            notification.post(statusNotification);
        }
    });
}

function _getCurrentApplicationId() {
    return "ID_APPLICATION_0";
}

_self = function () {
    var push;

    function registerService(appControl, successCallback, errorCallback) {
        if (!_security.registerService) {
            throw new WebAPIException(errorcode.SECURITY_ERR);
        }

        t.PushManager("registerService", arguments, true);

        window.setTimeout(function () {
            var appId, appService;

            appId = _getCurrentApplicationId();
            appService = {
                appId:          appId,
                registrationId: null,
                appControl:     appControl,
                isRegistered:   false
            };
            _data.service[appId] = appService;

            event.trigger("PushRequest", ["REGISTER", appService], true);

            if (appService.registrationId === null) {
                if (errorCallback) {
                    errorCallback(new WebAPIError(errorcode.UNKNOWN_ERR));
                }
                return;
            }

            appService.isRegistered = true;
            successCallback(appService.registrationId);
        }, 1);
    }

    function unregisterService(successCallback, errorCallback) {
        if (!_security.unregisterService) {
            throw new WebAPIException(errorcode.SECURITY_ERR);
        }

        t.PushManager("unregisterService", arguments);

        window.setTimeout(function () {
            var appId;

            appId = _getCurrentApplicationId();
            delete _data.service[appId];
            event.trigger("PushRequest", ["UNREGISTER", appId]);
            if (successCallback) {
                successCallback();
            }
        }, 1);
    }

    function connectService(notificationCallback) {
        var appId, appService;

        if (!_security.connectService) {
            throw new WebAPIException(errorcode.SECURITY_ERR);
        }

        t.PushManager("connectService", arguments);

        appId = _getCurrentApplicationId();
        appService = _data.service[appId];
        if (!appService || !appService.isRegistered) {
            throw new WebAPIException(errorcode.UNKNOWN_ERR);
        }

        appService.isConnected = true;
        appService.onpushed    = notificationCallback;
        event.trigger("PushRequest", ["CONNECT", appId]);
    }

    function disconnectService() {
        var appId, appService;

        if (!_security.disconnectService) {
            throw new WebAPIException(errorcode.SECURITY_ERR);
        }

        t.PushManager("disconnectService", arguments);

        appId = _getCurrentApplicationId();
        appService = _data.service[appId];
        if (!appService || !appService.isRegistered ||
                !appService.isConnected) {
            return;
        }

        appService.onpushed    = null;
        appService.isConnected = false;
        event.trigger("PushRequest", ["DISCONNECT", appId]);
    }

    function getRegistrationId() {
        var appService;

        if (!_security.getRegistrationId) {
            throw new WebAPIException(errorcode.SECURITY_ERR);
        }

        t.PushManager("getRegistrationId", arguments);

        appService = _data.service[_getCurrentApplicationId()];
        if (!appService || !appService.isRegistered) {
            return null;
        }

        return appService.registrationId;
    }

    function handleSubFeatures(subFeatures) {
        var i, subFeature;

        for (subFeature in subFeatures) {
            for (i in _security[subFeature]) {
                _security[_security[subFeature][i]] = true;
            }
        }
    }

    push = {
        registerService:   registerService,
        unregisterService: unregisterService,
        connectService:    connectService,
        disconnectService: disconnectService,
        getRegistrationId: getRegistrationId,
        handleSubFeatures: handleSubFeatures
    };

    return push;
};

_initialize();

PushMessage = function (pushMessageInitDict) {
    var appData, alertMessage, date;

    this.__defineGetter__("appData", function () {
        return appData;
    });

    this.__defineGetter__("alertMessage", function () {
        return alertMessage;
    });

    this.__defineGetter__("date", function () {
        return date;
    });

    appData      = pushMessageInitDict.appData || "";
    alertMessage = pushMessageInitDict.alertMessage || "";
    date         = pushMessageInitDict.date || new Date();
};

module.exports = _self;
