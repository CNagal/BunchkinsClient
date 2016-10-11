(function() {
    'use strict';

    angular
        .module('app')
        .factory('bunchkinsFactory', bunchkinsFactory);

    bunchkinsFactory.$inject = ['$rootScope', 'Hub', '$timeout', 'signalRUrl'];

    /* @ngInject */
    function bunchkinsFactory($rootScope, Hub, $timeout, signalRUrl) {

        var service = {
            game: {
                connected: '',
                gameId: '',
                gameState: ''
            },
            player: {
                name: '',
                hand: [],
                equips: []
            },
            opponents: [],
            createGame: createGame,
            joinGame: joinGame,
            startGame: startGame,
            proceed: proceed
        };

        var hub = new Hub('bunchkinsHub', {
            //client side methods
            listeners: {
                'callerJoined': function(gameId, players) {
                    service.game.gameId = gameId;
                    // append to original opponents object to preserve bindings
                    if (players) {
                        players.forEach(function(element){
                            service.opponents.push(element);
                        });
                    }
                    console.log("Joined game " + gameId);
                    $rootScope.$apply();
                },
                'playerJoined': function(player) {
                    service.opponents.push(player);
                    console.log(player.name + " joined");
                    $rootScope.$apply();
                },
                'displayError': function(errorString) {
                    console.log(errorString);
                },
                'gameStarted': function() {
                    $rootScope.$broadcast('gameStarted', service.game.gameState);
                },
                'stateChanged': function() {
                    $rootScope.$broadcast('stateChanged', service.game.gameState);
                },
                'updateHand': function(hand) {
                    service.player.hand = hand;
                    $rootScope.$broadcast('handChanged', service.game.gameState);
                },
                // maybe call specific method for action logging instead
                // front-end doesn't care about passed, just state change
                'passed': function(player) {
                    $rootScope.$broadcast('passed', player);
                }
            },

            //server side methods
            methods: ['createGame', 'joinGame', 'startGame', 'proceed', 'fight', 'run', 'pass', 'playCard'],

            //handle connection error
            errorHandler: function(error) {
                console.error(error);
            },

            //specify a non default root
            rootPath: signalRUrl,
            logging: true,

            stateChanged: function(state) {
                switch (state.newState) {
                    case $.signalR.connectionState.connecting:
                        //your code here
                        break;
                    case $.signalR.connectionState.connected:
                        service.connected = true;
                        break;
                    case $.signalR.connectionState.reconnecting:
                        //your code here
                        break;
                    case $.signalR.connectionState.disconnected:
                        service.connected = false;
                        break;
                }
            }
        });

        function createGame(playerName) {
            hub.createGame(playerName);
            service.player.name = playerName;
            service.player.IsActive = true;
        }

        function joinGame(playerName, gameId) {
            hub.joinGame(playerName, gameId);
            service.game.gameId = gameId;
        }

        function startGame() {
            hub.startGame(service.game.gameId);
        }

        function proceed() {
            hub.proceed(service.gameId, service.player.name); //Calling a server method
        }

        return service;
    }
})();
