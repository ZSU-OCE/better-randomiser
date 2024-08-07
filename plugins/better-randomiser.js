import BasePlugin from './base-plugin.js';

export default class BetterRandomiser extends BasePlugin {
  static get description() {
    return (
      "The <code>BetterRandomiser</code> can be used to randomise teams. It's great for destroying clan stacks or for " +
      'social events. It can be run by typing, by default, <code>!randomise</code> into in-game admin chat'
    );
  }

  static get defaultEnabled() {
    return true;
  }

  static get optionsSpecification() {
    return {
      command: {
        required: false,
        description: 'The command used to randomise the teams.',
        default: 'randomise'
      },
      stopCommand: {
        required: false,
        description: 'The command used to stop the randomisation.',
        default: 'stoprandomise'
      },
      startBroadcast: {
        required: false,
        description: 'The message broadcasted when the team randomisation is scheduled.',
        default: "We will be shuffling teams at the start of next game. We will attempt to keep you together with your squad, but this isn't guaranteed. This system is automated."
      },
      enableStartBroadcast: {
        required: false,
        description: 'Enable or disable the start broadcast.',
        default: true
      },
      stopBroadcast: {
        required: false,
        description: 'The message broadcasted when the team randomisation is cancelled.',
        default: "Team randomisation has been cancelled."
      },
      enableStopBroadcast: {
        required: false,
        description: 'Enable or disable the stop broadcast.',
        default: true
      },
      intervalBroadcast: {
        required: false,
        description: 'The message broadcasted at intervals before the randomisation occurs.',
        default: "We will be shuffling teams at the start of next game. We will attempt to keep you together with your squad, but this isn't guaranteed. This system is automated."
      },
      enableIntervalBroadcast: {
        required: false,
        description: 'Enable or disable the interval broadcast.',
        default: true
      },
      intervalTime: {
        required: false,
        description: 'The interval time in minutes for the interval broadcast.',
        default: 5
      },
      alreadyScheduledMessage: {
        required: false,
        description: 'The message sent to the player if team randomisation is already scheduled.',
        default: "Team randomisation is already scheduled."
      },
      notScheduledMessage: {
        required: false,
        description: 'The message sent to the player if team randomisation has not been scheduled yet.',
        default: "Team randomisation has not been scheduled yet."
      },
      checkInterval: {
        required: false,
        description: 'The interval in seconds for checking and swapping players after the new game starts.',
        default: 5
      },
      totalCheckTime: {
        required: false,
        description: 'The total time in seconds to continue checking and swapping players after the new game starts.',
        default: 60
      }
    };
  }

  constructor(server, options, connectors) {
    super(server, options, connectors);
    this.onChatCommand = this.onChatCommand.bind(this);
    this.onStopCommand = this.onStopCommand.bind(this);
    this.onNewGame = this.onNewGame.bind(this);
    this.updateSquadList = this.updateSquadList.bind(this);
    this.savedTeams = null;
    this.updateInterval = null;
    this.intervalBroadcastInterval = null;
    this.checkInterval = null;
    this.isScheduled = false;
  }

  async mount() {
    this.server.on(`CHAT_COMMAND:${this.options.command}`, this.onChatCommand);
    this.server.on(`CHAT_COMMAND:${this.options.stopCommand}`, this.onStopCommand);
    this.server.on('NEW_GAME', this.onNewGame);
  }

  async unmount() {
    this.server.removeEventListener(`CHAT_COMMAND:${this.options.command}`, this.onChatCommand);
    this.server.removeEventListener(`CHAT_COMMAND:${this.options.stopCommand}`, this.onStopCommand);
    this.server.removeEventListener('NEW_GAME', this.onNewGame);
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    if (this.intervalBroadcastInterval) {
      clearInterval(this.intervalBroadcastInterval);
    }
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  async broadcast(msg) {
    await this.server.rcon.broadcast(msg);
  }

  async logCurrentTeams(players) {
    const teams = this.organizeTeams(players);
    for (const teamID in teams) {
      const team = teams[teamID];
      let logMessage = `Current ${team.teamName}:\n`;
      for (const squad of team.squads) {
        logMessage += `${squad.squadName}: ${squad.players.map(player => player.name).join(', ')}\n`;
      }
      this.verbose(1, logMessage);
    }
  }

  organizeTeams(players) {
    const teams = {
      1: {
        teamID: '1',
        teamName: 'Team 1',
        squads: [
          {
            squadID: '0',
            squadName: 'Unassigned',
            teamID: '1',
            isCommandSquad: false,
            players: [],
          },
        ],
        players: [],
      },
      2: {
        teamID: '2',
        teamName: 'Team 2',
        squads: [
          {
            squadID: '0',
            squadName: 'Unassigned',
            teamID: '2',
            isCommandSquad: false,
            players: [],
          },
        ],
        players: [],
      },
    };

    for (const player of players) {
      if (teams[player.teamID]) {
        teams[player.teamID].players.push(player);
        if (player.squadID === null) {
          teams[player.teamID].squads[0].players.push(player);
        } else {
          let squad = teams[player.teamID].squads.find(squad => squad.squadID === player.squadID);
          if (squad) {
            squad.players.push(player);
          } else {
            squad = {
              squadID: player.squadID,
              squadName: `Squad ${player.squadID}`,
              teamID: player.teamID,
              isCommandSquad: false,
              players: [player],
            };
            teams[player.teamID].squads.push(squad);
          }
        }
      } else {
        this.verbose(1, `Unknown teamID: ${player.teamID}, playerID: ${player.id}`);
      }
    }

    for (const teamID in teams) {
      const unassignedSquad = teams[teamID].squads[0];
      unassignedSquad.size = unassignedSquad.players.length;
    }

    return teams;
  }

  async onChatCommand(info) {
    if (info.chat !== 'ChatAdmin') return;

    if (this.isScheduled) {
      await this.server.rcon.warn(info.eosID, this.options.alreadyScheduledMessage);
      return;
    }

    await this.updateSquadList();
    this.updateInterval = setInterval(this.updateSquadList, 300000); // Update every 5 minutes

    if (this.options.enableStartBroadcast) {
      this.broadcast(this.options.startBroadcast);
    }

    if (this.options.enableIntervalBroadcast) {
      this.intervalBroadcastInterval = setInterval(
        () => this.broadcast(this.options.intervalBroadcast),
        this.options.intervalTime * 60000
      ); // Interval broadcast every X minutes
    }

    this.verbose(1, `Teams have been saved and will be updated every 5 minutes until the new game starts.`);
    this.isScheduled = true;
  }

  async onStopCommand(info) {
    if (info.chat !== 'ChatAdmin') return;

    if (!this.isScheduled) {
      await this.server.rcon.warn(info.eosID, this.options.notScheduledMessage);
      return;
    }

    clearInterval(this.updateInterval);
    clearInterval(this.intervalBroadcastInterval);
    clearInterval(this.checkInterval);
    this.updateInterval = null;
    this.intervalBroadcastInterval = null;
    this.checkInterval = null;
    this.savedTeams = null;
    this.isScheduled = false;

    if (this.options.enableStopBroadcast) {
      this.broadcast(this.options.stopBroadcast);
    }

    this.verbose(1, `Team randomisation process has been cancelled.`);
  }

  async updateSquadList() {
    const players = this.server.players.slice(0);
    await this.logCurrentTeams(players);

    this.savedTeams = this.organizeTeams(players);

    this.verbose(1, `Updated squad list has been saved.`);
  }

  async onNewGame() {
    if (this.savedTeams) {
      this.verbose(1, `Executing saved team randomisation immediately and checking for the next 60 seconds...`);
      clearInterval(this.updateInterval); // Stop updating the squad list
      clearInterval(this.intervalBroadcastInterval); // Stop interval broadcasts

      const switchTeams = async () => {
        const players = this.server.players.slice(0);
        for (const player of this.savedTeams[1]) {
          const serverPlayer = players.find(p => p.eosID === player.eosID);
          if (serverPlayer && serverPlayer.teamID !== '1') {
            await this.server.rcon.switchTeam(player.eosID);
          }
        }
        for (const player of this.savedTeams[2]) {
          const serverPlayer = players.find(p => p.eosID === player.eosID);
          if (serverPlayer && serverPlayer.teamID !== '2') {
            await this.server.rcon.switchTeam(player.eosID);
          }
        }
      };

      // Switch teams immediately
      await switchTeams();

      // Check and switch teams every X seconds for 60 seconds
      const checkIntervalDuration = this.options.checkInterval * 1000;
      const totalCheckDuration = this.options.totalCheckTime * 1000;
      let elapsedTime = 0;

      this.checkInterval = setInterval(async () => {
        if (elapsedTime >= totalCheckDuration) {
          clearInterval(this.checkInterval);
          this.checkInterval = null;

          // Final balance check and adjustments if needed
          const team1Count = this.savedTeams[1].length;
          const team2Count = this.savedTeams[2].length;
          const difference = Math.abs(team1Count - team2Count);

          if (difference >= 4) {
            const largerTeam = team1Count > team2Count ? 1 : 2;
            const smallerTeam = largerTeam === 1 ? 2 : 1;

            const unassignedPlayersFromLargerTeam = this.savedTeams[largerTeam].filter(player => player.squadID === '0');

            for (let i = 0; i < Math.floor(difference / 2); i++) {
              if (unassignedPlayersFromLargerTeam.length > 0) {
                const player = unassignedPlayersFromLargerTeam.pop();
                this.savedTeams[smallerTeam].push(player);
                this.savedTeams[largerTeam] = this.savedTeams[largerTeam].filter(p => p !== player);
                await this.server.rcon.switchTeam(player.eosID); // Swap the unassigned player
              } else {
                break;
              }
            }
          }

          this.verbose(1, `Adjusted team 1: ${this.savedTeams[1].map(player => player.name).join(', ')}`);
          this.verbose(1, `Adjusted team 2: ${this.savedTeams[2].map(player => player.name).join(', ')}`);

          return;
        }

        await switchTeams();
        elapsedTime += checkIntervalDuration;
      }, checkIntervalDuration);

      this.savedTeams = null;
      this.isScheduled = false;
    }
  }
}
