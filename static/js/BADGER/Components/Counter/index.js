(function () {
    'use strict';

    TLRGRP.namespace('TLRGRP.BADGER.Dashboard.Components');

    var idIncrementor = 0;

    TLRGRP.BADGER.Dashboard.Components.Counter = function (configuration) {
        var inlineLoading = new TLRGRP.BADGER.Dashboard.ComponentModules.InlineLoading();
        var counterElement;

        if(!configuration.graph) {
            configuration.graph = {};
        }

        if(configuration.counter) {
            configuration.graph.counterWindow = configuration.counter.window;
        }

        var componentModules = [];

        componentModules.push(inlineLoading);
        componentModules.push({
            appendTo: function(container) {
                counterElement = $('<div />');

                container.append(counterElement);
            }
        });

        var componentLayout = new TLRGRP.BADGER.Dashboard.ComponentModules.ComponentLayout({
            title: configuration.title,
            layout: configuration.layout,
            componentClass: 'graph-and-counter-component',
            modules: componentModules
        });

        var dataStore;
        var dataStoreId = 'Counter-' + idIncrementor++;

        function refreshComplete(data) {
            if(configuration.storeId) {
                data = JSON.parse(JSON.stringify(data))
            }

            var value = TLRGRP.BADGER.Utilities.object.getValueFromSubProperty(data, configuration.value);
            counterElement.text(value);
            //counter.setValue(data);
        }

        if(configuration.storeId) {
            dataStore = {
                start: function () {
                    TLRGRP.messageBus.publish('TLRGRP.BADGER.SharedDataStore.Subscribe.' + configuration.storeId, {
                        id: dataStoreId,
                        refreshComplete: refreshComplete,
                        loading: inlineLoading
                    });
                },
                stop: function () {
                    TLRGRP.messageBus.publish(dataStoreId);
                }
            };
        } 
        else {
            dataStore = new TLRGRP.BADGER.Dashboard.DataStores.SyncAjaxDataStore({
                request:  new TLRGRP.BADGER.Dashboard.DataSource[(configuration.dataSource || 'cube')](configuration),
                refresh: 5000,
                mappings: configuration.mappings,
                callbacks: {
                    success: refreshComplete
                },
                components: {
                    loading: inlineLoading
                }
            });
        } 

        var stateMachine = nano.Machine({
            states: {
                uninitialised: {
                    initialise: function (container) {
                        inlineLoading.loading();
                        componentLayout.appendTo(container);
                        this.transitionToState('initialised');
                    }
                },
                initialised: {
                    _onEnter: function () {
                        dataStore.start(true);
                    },
                    stop: function() {
                        dataStore.stop();
                    },
                    remove: function() {
                    }
                }
            },
            initialState: 'uninitialised'
        });

        return {
            render: function (container) {
                return stateMachine.handle('initialise', container);
            },
            unload: function () {
                stateMachine.handle('stop');
                stateMachine.handle('remove');
            }
        };
    };
})();

