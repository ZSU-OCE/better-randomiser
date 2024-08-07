import BasePlugin from './base-plugin.js';

export default class BetterRandomiser extends BasePlugin {
  static get description() {
    return (
      "The <code>TeamRandomiser</code> can be used to randomise teams. It's great for destroying clan stacks or for " +
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
      stopBroadcast: {
        required: false,
        description: 'The message broadcasted when the team randomisation is cancelled.',
        default: "Team randomisation has been cancelled."
      },
      warnPlayerMessage: {
        required: false,
        description: 'The message sent to warn players before team randomisation.',
        default: "Initiating team randomise. You may be swapped."
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
      await this.server.rcon.warn(info.steamID, this.options.alreadyScheduledMessage);
      return;
    }

    await this.updateSquadList();
    this.updateInterval = setInterval(this.updateSquadList, 300000); // Update every 5 minutes

    this.broadcast(this.options.startBroadcast);

    this.verbose(1, `Teams have been saved and will be updated every 5 minutes until the new game starts.`);
    this.isScheduled = true;
  }

  async onStopCommand(info) {
    if (info.chat !== 'ChatAdmin') return;

    if (!this.isScheduled) {
      await this.server.rcon.warn(info.steamID, this.options.notScheduledMessage);
      return;
    }

    clearInterval(this.updateInterval);
    this.updateInterval = null;
    this.savedTeams = null;
    this.isScheduled = false;

    this.broadcast(this.options.stopBroadcast);

    this.verbose(1, `Team randomisation process has been cancelled.`);
  }

  async updateSquadList() {
    const players = this.server.players.slice(0);
    await this.logCurrentTeams(players);

    const teams = this.organizeTeams(players);
    const newTeams = { 1: [], 2: [] };
    let team1Count = 0;
    let team2Count = 0;

    // Shuffle squads for randomness
    const allSquads = teams[1].squads.concat(teams[2].squads);
    for (let i = allSquads.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allSquads[i], allSquads[j]] = [allSquads[j], allSquads[i]];
    }

    // Move squads to new teams
    for (const squad of allSquads) {
      if (squad.squadID === '0') continue; // Skip unassigned
      const squadSize = squad.players.length;
      if (team1Count <= team2Count) {
        newTeams[1].push(...squad.players);
        team1Count += squadSize;
      } else {
        newTeams[2].push(...squad.players);
        team2Count += squadSize;
      }
    }

    // Use unassigned players to balance teams
    const unassignedPlayers = teams[1].squads[0].players.concat(teams[2].squads[0].players);
    for (const player of unassignedPlayers) {
      if (team1Count <= team2Count) {
        newTeams[1].push(player);
        team1Count++;
      } else {
        newTeams[2].push(player);
        team2Count++;
      }
    }

    // Final balance check and swap smaller squads if needed
    while (Math.abs(team1Count - team2Count) > 2) {
      const largerTeam = team1Count > team2Count ? 1 : 2;
      const smallerTeam = largerTeam === 1 ? 2 : 1;

      const smallestSquadIndex = newTeams[largerTeam].findIndex(player =>
        newTeams[largerTeam].filter(p => p.squadID === player.squadID).length === 1
      );

      if (smallestSquadIndex === -1) break;

      const smallestSquad = newTeams[largerTeam].splice(smallestSquadIndex, 1);
      newTeams[smallerTeam].push(...smallestSquad);

      team1Count = newTeams[1].length;
      team2Count = newTeams[2].length;
    }

    // Final balance check and split the highest squad if needed
    while (Math.abs(team1Count - team2Count) > 2) {
      const largerTeam = team1Count > team2Count ? 1 : 2;
      const smallerTeam = largerTeam === 1 ? 2 : 1;

      const largestSquad = newTeams[largerTeam].reduce((prev, curr) =>
        prev.squadID > curr.squadID ? prev : curr
      );

      const splitIndex = Math.ceil(largestSquad.players.length / 2);
      newTeams[smallerTeam].push(...largestSquad.players.splice(0, splitIndex));
      newTeams[largerTeam] = newTeams[largerTeam].filter(
        player => player.squadID !== largestSquad.squadID
      );
      newTeams[largerTeam].push(...largestSquad.players);

      team1Count = newTeams[1].length;
      team2Count = newTeams[2].length;
    }

    this.savedTeams = newTeams;

    this.broadcast(this.options.startBroadcast);

    this.verbose(1, `Updated squad list has been saved.`);
  }

  async warnPlayers() {
    for (const player of this.server.players) {
      if (!player.steamID) {
        this.verbose(1, `Skipping player ${player.name} due to missing steamID`);
        continue;
      }

      try {
        await this.server.rcon.warn(player.steamID, this.options.warnPlayerMessage);
      } catch (error) {
        this.verbose(1, `Failed to warn player ${player.name}: ${error.message}`);
      }
    }
  }

  async onNewGame() {
    if (this.savedTeams) {
      this.verbose(1, `Executing saved team randomisation in 20 seconds...`);
      clearInterval(this.updateInterval); // Stop updating the squad list

      setTimeout(async () => {
        await this.warnPlayers();
      }, 15000); // Warn players 15 seconds after the new game starts

      setTimeout(async () => {
        const players = this.server.players.slice(0);
        const newUnassignedPlayers = players.filter(
          player => !this.savedTeams[1].includes(player) && !this.savedTeams[2].includes(player)
        );

        // Add new unassigned players to the saved teams
        for (const player of newUnassignedPlayers) {
          if (this.savedTeams[1].length <= this.savedTeams[2].length) {
            this.savedTeams[1].push(player);
          } else {
            this.savedTeams[2].push(player);
          }
        }

        // Final check for balance
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
            } else {
              break;
            }
          }
        }

        this.verbose(1, `New randomised team 1: ${this.savedTeams[1].map(player => player.name).join(', ')}`);
        this.verbose(1, `New randomised team 2: ${this.savedTeams[2].map(player => player.name).join(', ')}`);
        this.savedTeams = null;
        this.isScheduled = false;
      }, 20000); // 20 seconds delay
    }
  }
}
