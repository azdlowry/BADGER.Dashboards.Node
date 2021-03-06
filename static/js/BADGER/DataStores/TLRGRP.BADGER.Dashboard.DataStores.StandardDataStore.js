﻿(function () {
    'use strict';

    TLRGRP.namespace('TLRGRP.BADGER.Dashboard.DataStores');

    var defaultOptions = {
        pauseWhenNotVisible: true,
        components: {},
        refresh: 10000
    };

    var currentTimeFrame = {
        timeFrame: 1,
        units: 'hours'
    };

    TLRGRP.messageBus.subscribe('TLRGRP.BADGER.TimePeriod.Set', function(timeFrameData) {
        currentTimeFrame = timeFrameData;
    });

    TLRGRP.BADGER.Dashboard.DataStores.StandardDataStore = function (options) {
        var currentOptions = $.extend(true, {}, defaultOptions, options);
        var currentTimeout;
        var defaultAjaxOptions = {
            type: 'GET'
        };
        var stateMachine = nano.Machine({
            states: {
                stopped: {
                    _onEnter: function () {
                        clearCurrentTimeout();
                    },
                    start: function (doItNow) {
                        if (doItNow) {
                            this.transitionToState('refreshing');
                            return;
                        }
                        this.transitionToState('waiting');
                    },
                    refreshComplete: function (data) {
                        if(currentOptions.request && currentOptions.request.responseMapper) {
                            data = currentOptions.request.responseMapper(data);
                        }
                        executeSuccessCallbackIfSpecified(data);
                    },
                    refreshFailed: function (errorInfo) {
                        executeErrorCallbackIfSpecified(errorInfo);
                    }
                },
                waiting: {
                    _onEnter: function () {
                        var stateMachineApi = this;

                        currentTimeout = setTimeout(function () {
                            stateMachineApi.transitionToState('refreshing');
                        }, currentOptions.refresh);
                    },
                    start: function (doItNow) {
                        var stateMachineApi = this;

                        if (doItNow) {
                            clearTimeout(currentTimeout);
                            this.transitionToState('refreshing');
                            return;
                        }

                        currentTimeout = setTimeout(function () {
                            stateMachineApi.transitionToState('refreshing');
                        }, currentOptions.refresh);
                    },
                    stop: function () {
                        this.transitionToState('stopped');
                    }
                },
                refreshing: {
                    _onEnter: function () {
                        if (currentOptions.components.loading) {
                            currentOptions.components.loading.loading();
                        }

                        var queries = currentOptions.request.requestBuilder({
                            timeFrame: currentTimeFrame
                        });

                        var responses = {};
                        var deferreds = _.map(queries, function(queryOptions) {
                            var ajaxOptions = {
                                url: currentOptions.url,
                                data: currentOptions.data,
                                success: function(data) {
                                    responses[queryOptions.id] = data;
                                }
                            };

                            if(currentOptions.request && currentOptions.request.requestBuilder) {
                                ajaxOptions = $.extend(ajaxOptions, queryOptions);
                            }

                            if (currentOptions.type) {
                                ajaxOptions.type = currentOptions.type;
                            }

                            if (currentOptions.contentType) {
                                ajaxOptions.contentType = currentOptions.contentType;
                            }

                            return $.ajax($.extend(true, {}, defaultAjaxOptions, ajaxOptions));
                        });

                        $.when.apply(undefined, deferreds)
                            .fail(function() {
                                stateMachine.handle('refreshFailed');
                            })
                            .then(function() {
                                var combinedData = [];

                                stateMachine.handle('refreshComplete', combinedData);
                            });
                    },
                    refreshComplete: function (data) {
                        executeSuccessCallbackIfSpecified(data);
                        
                        if (currentOptions.components.loading) {
                            currentOptions.components.loading.finished();
                        }

                        this.transitionToState('waiting');
                    },
                    refreshFailed: function (errorInfo) {
                        executeErrorCallbackIfSpecified(errorInfo);

                        if (currentOptions.components.loading) {
                            currentOptions.components.loading.finished();
                        }

                        this.transitionToState('waiting');
                    },
                    stop: function () {
                        this.transitionToState('stopped');
                    }
                }
            },
            initialState: 'stopped'
        });

        function clearCurrentTimeout() {
            if (currentTimeout) {
                clearTimeout(currentTimeout);
            }
        }

        function executeSuccessCallbackIfSpecified(data) {
            if (currentOptions.callbacks.success && $.isFunction(currentOptions.callbacks.success)) {
                currentOptions.callbacks.success(data);
            }
            
            if (currentOptions.components.lastUpdated) {
                currentOptions.components.lastUpdated.setLastUpdated(data.refreshedAt);
            }
        }

        function executeErrorCallbackIfSpecified(errorInfo) {
            if (currentOptions.callbacks.error && $.isFunction(currentOptions.callbacks.error)) {
                currentOptions.callbacks.error(errorInfo);
            }

            if (currentOptions.components.lastUpdated) {
                currentOptions.components.lastUpdated.refreshText();
            }
        }

        function setNewRefresh(refreshIn) {
            currentOptions.refresh = refreshIn;
        }

        if (currentOptions.pauseWhenNotVisible) {
            TLRGRP.messageBus.subscribe('TLRGRP.BADGER.PAGE.Hidden', function () {
                stateMachine.handle('pause');
            });

            TLRGRP.messageBus.subscribe('TLRGRP.BADGER.PAGE.Visible', function () {
                stateMachine.handle('unpause');
            });
        }

        TLRGRP.messageBus.subscribe('TLRGRP.BADGER.TimePeriod.Selected', function(timeFrameData) {
            stateMachine.handle('stop');
            
            currentTimeFrame = timeFrameData;

            stateMachine.handle('start', true);
        });

        return {
            start: function (doItNow) {
                stateMachine.handle('start', doItNow);
            },
            stop: function () {
                stateMachine.handle('stop');
            },
            setNewRefresh: function (newRefresh) {
                setNewRefresh(newRefresh);
            }
        };
    };
})();
