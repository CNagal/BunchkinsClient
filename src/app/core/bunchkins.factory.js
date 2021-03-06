(function() {
    'use strict';

    angular
        .module('app')
        .factory('bunchkinsFactory', bunchkinsFactory);

    bunchkinsFactory.$inject = ['$rootScope', 'Hub', '$timeout', 'signalRUrl', '$window', 'toastr', '$state', 'localStorageService'];

    /* @ngInject */
    function bunchkinsFactory($rootScope, Hub, $timeout, signalRUrl, $window, toastr, $state, localStorageService) {

        var service = {
            game: {
                gameId: '',
                gameState: {},
                activePlayer: ''
            },
            player: {
                name: '',
                level: 0,
                hand: [],
                equippedCards: {}
            },
            opponents: [],
            createGame: createGame,
            joinGame: joinGame,
            startGame: startGame,
            playCard: playCard,
            discard: discard,
            proceed: proceed,
            fight: fight,
            run: run,
            pass: pass,
            leaveGame: leaveGame
        };

        var hub = new Hub('bunchkinsHub', {
            //client side methods
            listeners: {
                'callerJoined': function(gameId, players) {
                    service.game.gameId = gameId;
                    // append to original opponents object to preserve bindings
                    if (players) {
                        players.forEach(function(element) {
                            service.opponents.push(element);
                        });
                    }
                    $rootScope.$apply();
                },
                'playerJoined': function(player) {
                    service.opponents.push(player);
                    console.log(player.name + " joined");
                    $rootScope.$apply();
                },
                'playerLeft': function(playerName) {
                    var index = service.opponents.findIndex(function(element) {
                        return element.name == playerName;
                    });
                    service.opponents.splice(index, 1);
                    toastr.success("Player " + playerName + " left the game.");
                },
                'displayError': function(errorString) {
                    toastr.error(errorString);
                },
                'gameStarted': function() {
                    $rootScope.$broadcast('gameStarted', service.game.gameState);
                },
                'updateState': function(state) {
                    service.game.gameState = state;
                    if (state.name == "CombatState") {
                        service.game.gameState.canPlayerWin = canPlayerWinCombat();
                    }
                    $rootScope.$apply();
                    // $rootScope.$broadcast('stateChanged', service.game.gameState);
                },
                'updateActivePlayer': function(playerName) {
                    service.game.activePlayer = playerName;
                    $rootScope.$apply();
                    $rootScope.$broadcast('activePlayerChanged', playerName);
                },
                'updatePlayer': function(player) {
                    service.player.level = player.level;
                    service.player.combatPower = player.combatPower;
                    service.player.hand = player.hand;
                    service.player.equippedCards = player.equippedCards;
                    $rootScope.$apply();
                },
                'updateOpponent': function(player) {
                    var index = service.opponents.findIndex(function(element) {
                        return element.name == player.name;
                    });
                    var opponent = service.opponents[index];
                    opponent.level = player.level;
                    opponent.combatPower = player.combatPower;
                    opponent.handSize = player.handSize;
                    opponent.equippedCards = player.equippedCards;
                    $rootScope.$apply();
                },
                'updateHand': function(hand) {
                    service.player.hand = hand;
                    $rootScope.$apply();
                },
                'updateOpponentHand': function(playerName, handSize) {
                    var index = service.opponents.findIndex(function(element) {
                        return element.name == playerName;
                    });
                    service.opponents[index].handSize = handSize;
                },
                'updateLevel': function(playerName, level, combatPower) {
                    if (playerName == service.player.name) {
                        service.player.level = level;
                        service.player.combatPower = combatPower;
                    } else {
                        var index = service.opponents.findIndex(function(element) {
                            return element.name == playerName;
                        });
                        service.opponents[index].level = level;
                        service.opponents[index].combatPower = combatPower;
                    }
                    $rootScope.$apply();
                },
                'cardPlayed': function(playerName, targetName, card) {
                    $rootScope.$broadcast('cardPlayed', {
                        playerName: playerName,
                        targetName: targetName,
                        card: card
                    });
                },
                'winzor': function(player) {
                    //service.game.;
                    $state.go("win", { 'player' : player });
                    console.log(player);
                    $rootScope.$broadcast(player);

                    service.game = {};
                    service.player = {};
                    service.opponents = [];
                    //$rootScope.$apply();

                    console.log("Winzor Happened.....Probably");
                },
                'userDisconnected': function(playerName) {
                    alert('Player disconnected');
                },
                'userReconnected': function(playerName) {
                    alert('Player reconnected');
                },
                // called when reconnecting to active game
                'setGameInfo': function(game, player, opponents) {
                    // Can overwrite objects because in "lobby" state
                    // New GameController will bind to these new objects
                    service.game = game;
                    service.player = player;
                    service.opponents = opponents;

                    // Tell LobbyController to change state to "game"
                    $rootScope.$broadcast('gameStarted', service.game.gameState);
                }
            },

            //server side methods
            methods: ['createGame', 'joinGame', 'startGame', 'proceed', 'fight', 'run', 'pass', 'playCard', 'discard', 'leaveGame'],

             //query params sent on initial connection
            queryParams: {
                'username': localStorageService.get('username')
            },

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
            localStorageService.set('username', playerName);
            service.player.name = playerName;
            service.player.isHost = true;
        }

        function joinGame(playerName, gameId) {
            hub.joinGame(playerName, gameId);
            localStorageService.set('username', playerName);
            service.player.name = playerName;
        }

        function startGame() {
            hub.startGame(service.game.gameId);
        }

        function playCard(targetName, card) {
            if ((service.game.gameState.name == "CombatState" && card.type != "Equipment") || (service.game.gameState.name != "CombatState" && card.type != "CombatSpell")) {
                hub.playCard(service.game.gameId, service.player.name, targetName, card.cardId);
            }
        }

        function discard(card) {
            hub.discard(service.game.gameId, service.player.name, card.cardId);
        }

        function proceed() {
            if (service.player.name == service.game.activePlayer) {
                // game state check
                if (service.game.gameState.name != "CombatState" ||
                    (service.game.gameState.playersPassed.length == service.opponents.length && canPlayerWinCombat())) {
                    hub.proceed(service.game.gameId, service.player.name); //Calling a server method
                }
            }
        }

        function fight() {
            if (service.player.name == service.game.activePlayer && service.game.gameState.name == "DrawState") {
                hub.fight(service.game.gameId, service.player.name); //Calling a server method
            }
        }

        function run() {
            if (service.player.name == service.game.activePlayer && service.game.gameState.name == "CombatState") {
                hub.run(service.game.gameId, service.player.name); //Calling a server method
            }
        }

        function pass() {
            if (service.player.name != service.game.activePlayer && service.game.gameState.name == "CombatState") {
                hub.pass(service.game.gameId, service.player.name); //Calling a server method
            }
        }

        function canPlayerWinCombat() {
            var combatPower = 0;
            if (service.player.name == service.game.activePlayer) {
                combatPower = service.player.combatPower;
            } else {
                var index = service.opponents.findIndex(function(element) {
                    return element.name == service.game.activePlayer;
                });
                combatPower = service.opponents[index].combatPower;
            }

            if (combatPower + service.game.gameState.playerCombatBonus > service.game.gameState.monsterCombatPower + service.game.gameState.monsterCombatBonus) {
                return true;
            }

            return false;
        }

        function leaveGame(gameId, playerName){
            hub.leaveGame(gameId, playerName);
            localStorageService.set('username', '');
            service.game.gameId = "";
            service.player.name = "";
            $rootScope.$apply();
        }

        $window.onbeforeunload = function (e) {
            var dialog = "Black Silk, the blackest of silk";
            event.returnValue = dialog;
            return dialog;
        }

        $window.onunload = function () {
            // leaveGame(service.game.gameId, service.player.name);
        }

        return service;
    }
})();
