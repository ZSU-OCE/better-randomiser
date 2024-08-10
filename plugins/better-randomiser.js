import BasePlugin from "./base-plugin.js";

export default class BetterRandomiser extends BasePlugin {
  static get description() {
    return (
      "The <code>BetterRandomiser</code> can be used to randomise teams. It's great for destroying clan stacks or for " +
      "social events. It can be run by typing, by default, <code>!randomise</code> into in-game admin chat"
    );
  }

  static get defaultEnabled() {
    return true;
  }

  static get optionsSpecification() {
    return {
      command: {
        required: false,
        description: "The command used to randomise the teams.",
        default: "randomise",
      },
      stopCommand: {
        required: false,
        description: "The command used to stop the randomisation.",
        default: "stoprandomise",
      },
      forceCommand: {
        required: false,
        description:
          "The command used to force the randomisation process as if the new game started.",
        default: "forcerandomise",
      },
      startBroadcast: {
        required: false,
        description:
          "The message broadcasted when the team randomisation is scheduled.",
        default:
          "We will be shuffling teams at the start of next game. We will attempt to keep you together with your squad, but this isn't guaranteed. This system is automated.",
      },
      enableStartBroadcast: {
        required: false,
        description: "Enable or disable the start broadcast.",
        default: true,
      },
      stopBroadcast: {
        required: false,
        description:
          "The message broadcasted when the team randomisation is cancelled.",
        default: "Team randomisation has been cancelled.",
      },
      enableStopBroadcast: {
        required: false,
        description: "Enable or disable the stop broadcast.",
        default: true,
      },
      intervalBroadcast: {
        required: false,
        description:
          "The message broadcasted at intervals before the randomisation occurs.",
        default:
          "We will be shuffling teams at the start of next game. We will attempt to keep you together with your squad, but this isn't guaranteed. This system is automated.",
      },
      enableIntervalBroadcast: {
        required: false,
        description: "Enable or disable the interval broadcast.",
        default: true,
      },
      intervalTime: {
        required: false,
        description: "The interval time in minutes for the interval broadcast.",
        default: 5,
      },
      alreadyScheduledMessage: {
        required: false,
        description:
          "The message sent to the player if team randomisation is already scheduled.",
        default: "Team randomisation is already scheduled.",
      },
      notScheduledMessage: {
        required: false,
        description:
          "The message sent to the player if team randomisation has not been scheduled yet.",
        default: "Team randomisation has not been scheduled yet.",
      },
      forceNotActiveMessage: {
        required: false,
        description:
          "The message sent to the player if they try to force randomisation when it is not active.",
        default: "Team randomisation is not currently active.",
      },
      checkInterval: {
        required: false,
        description:
          "The interval in seconds for checking and swapping players after the new game starts.",
        default: 5,
      },
      totalCheckTime: {
        required: false,
        description:
          "The total time in seconds to continue checking and swapping players after the new game starts.",
        default: 60,
      },
      updateSquadListInterval: {
        required: false,
        description:
          "The interval time in minutes for updating the squad list periodically.",
        default: 5,
      },
      swapWarningMessage: {
        required: false,
        description:
          "The message sent to a player when they are swapped to the other team.",
        default: "You have been automatically swapped to balance the teams.",
      },
      randomiseCompleteMessage: {
        required: false,
        description: "The message sent to admins when randomisation is complete.",
        default:
          "Randomise completed\n| Swapped {swappedPlayers} players\n| Team 1: {team1Count} players\n| Team 2: {team2Count} players",
      },
      randomiseFailedMessage: {
        required: false,
        description: "The message sent to admins if randomisation fails.",
        default: "!!!Randomise Failed!!!\n| Check SquadJS Logs",
      },
    };
  }

  constructor(server, options, connectors) {
    super(server, options, connectors);
    this.active = false; // Initialize the active flag to false
    this.onChatCommand = this.onChatCommand.bind(this);
    this.onStopCommand = this.onStopCommand.bind(this);
    this.onForceCommand = this.onForceCommand.bind(this); // Bind the force command method
    this.onNewGame = this.onNewGame.bind(this);
    this.updateSquadList = this.updateSquadList.bind(this);
    this.savedTeams = { Team1: [], Team2: [], Team0: [] }; // Initialize savedTeams properly
    this.updateInterval = null;
    this.intervalBroadcastInterval = null;
    this.checkInterval = null;
    this.isScheduled = false;
  }

  async mount() {
    this.active = false; // Set the active flag to false on plugin mount
    this.server.on(`CHAT_COMMAND:${this.options.command}`, this.onChatCommand);
    this.server.on(
      `CHAT_COMMAND:${this.options.stopCommand}`,
      this.onStopCommand
    );
    this.server.on(
      `CHAT_COMMAND:${this.options.forceCommand}`,
      this.onForceCommand
    ); // Register the force command
    this.server.on("NEW_GAME", this.onNewGame);
  }

  async unmount() {
    this.server.removeEventListener(
      `CHAT_COMMAND:${this.options.command}`,
      this.onChatCommand
    );
    this.server.removeEventListener(
      `CHAT_COMMAND:${this.options.stopCommand}`,
      this.onStopCommand
    );
    this.server.removeEventListener(
      `CHAT_COMMAND:${this.options.forceCommand}`,
      this.onForceCommand
    );
    this.server.removeEventListener("NEW_GAME", this.onNewGame);
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
    for (const teamName in teams) {
      const team = teams[teamName];
      let logMessage = `Current ${teamName}:\n`;
      for (const squadID in team) {
        const squad = team[squadID];
        logMessage += `Squad ${squadID}: ${squad
          .map((player) => player.name)
          .join(", ")}\n`;
      }
      this.verbose(1, logMessage);
    }
  }

  organizeTeams(players) {
    const teams = {
      Team1: {},
      Team2: {},
      Team0: {},
    };

    for (const player of players) {
      const teamName = `Team${player.teamID}`;
      if (!teams[teamName]) continue;
      if (!teams[teamName][player.squadID]) {
        teams[teamName][player.squadID] = [];
      }
      teams[teamName][player.squadID].push({
        name: player.name,
        eosID: player.eosID,
        teamID: player.teamID,
        squadID: player.squadID,
      });
    }

    return teams;
  }

  async onChatCommand(info) {
    if (info.chat !== "ChatAdmin") return;

    if (this.isScheduled) {
      await this.server.rcon.warn(
        info.eosID,
        this.options.alreadyScheduledMessage
      );
      return;
    }

    this.verbose(1, `Randomise command received, updating squad list...`);
    await this.updateSquadList();
    this.verbose(
      1,
      `Saved teams after updateSquadList: ${JSON.stringify(this.savedTeams)}`
    );
    this.updateInterval = setInterval(() => {
      this.updateSquadList();
      this.verbose(
        1,
        `Updated saved teams: ${JSON.stringify(this.savedTeams)}`
      );
    }, this.options.updateSquadListInterval * 60000); // Update periodically

    if (this.options.enableStartBroadcast) {
      this.broadcast(this.options.startBroadcast);
    }

    if (this.options.enableIntervalBroadcast) {
      this.intervalBroadcastInterval = setInterval(
        () => this.broadcast(this.options.intervalBroadcast),
        this.options.intervalTime * 60000
      ); // Interval broadcast every X minutes
    }

    this.verbose(
      1,
      `Teams have been saved and will be updated every ${this.options.updateSquadListInterval} minutes until the new game starts.`
    );
    this.isScheduled = true;
    this.active = true; // Set the active flag to true when the command is received
  }

  async onStopCommand(info) {
    if (info.chat !== "ChatAdmin") return;

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
    this.savedTeams = { Team1: [], Team2: [], Team0: [] };
    this.isScheduled = false;
    this.active = false; // Set the active flag to false when the command is stopped

    if (this.options.enableStopBroadcast) {
      this.broadcast(this.options.stopBroadcast);
    }

    this.verbose(1, `Team randomisation process has been cancelled.`);
  }

  async onForceCommand(info) {
    if (info.chat !== "ChatAdmin") return;

    if (!this.active) {
      await this.server.rcon.warn(
        info.eosID,
        this.options.forceNotActiveMessage
      );
      return;
    }

    this.verbose(
      1,
      `Force randomise command received, running onNewGame logic...`
    );
    await this.onNewGame();
  }

  async updateSquadList() {
    const players = this.server.players.slice(0);
    await this.logCurrentTeams(players);

    this.savedTeams = this.organizeTeams(players);

    this.verbose(
      1,
      `Updated squad list has been saved: ${JSON.stringify(this.savedTeams)}`
    );
  }

  async onNewGame() {
    if (!this.active) {
      this.verbose(1, "Team randomisation is not active, skipping onNewGame.");
      return;
    }

    this.verbose(
      1,
      `Starting onNewGame with savedTeams: ${JSON.stringify(this.savedTeams)}`
    );

    const team1HasPlayers = Object.values(this.savedTeams.Team1).some(
      (squad) => squad.length > 0
    );
    const team2HasPlayers = Object.values(this.savedTeams.Team2).some(
      (squad) => squad.length > 0
    );

    if (team1HasPlayers || team2HasPlayers) {
      this.verbose(
        1,
        `Executing saved team randomisation immediately and checking for the next 60 seconds...`
      );
      clearInterval(this.updateInterval);
      clearInterval(this.intervalBroadcastInterval);

      const toSwapTeam1 = this.getSquadsToSwap(this.savedTeams.Team1);
      const toSwapTeam2 = this.getSquadsToSwap(this.savedTeams.Team2);

      let elapsedTime = 0;
      let isExecuting = false; // Execution flag
      let totalSwaps = 0; // Track total number of players swapped

      this.checkInterval = setInterval(async () => {
        if (isExecuting) {
          this.verbose(
            1,
            `Skipping execution at ${
              elapsedTime / 1000
            } seconds as previous execution is still running.`
          );
          return;
        }

        isExecuting = true;
        this.verbose(1, `Checking teams at ${elapsedTime / 1000} seconds...`);

        try {
          totalSwaps += await this.attemptSwaps(toSwapTeam1, "1");
          totalSwaps += await this.attemptSwaps(toSwapTeam2, "2");
        } finally {
          isExecuting = false; // Reset the flag after execution
        }

        elapsedTime += this.options.checkInterval * 1000;

        if (
          elapsedTime >= this.options.totalCheckTime * 1000 ||
          (toSwapTeam1.length === 0 && toSwapTeam2.length === 0)
        ) {
          clearInterval(this.checkInterval);
          this.checkInterval = null;

          await this.finalBalanceCheck();

          // Recalculate team counts after the final balance
          const team1Count = Object.values(this.savedTeams.Team1).reduce(
            (count, squad) => count + squad.length,
            0
          );
          const team2Count = Object.values(this.savedTeams.Team2).reduce(
            (count, squad) => count + squad.length,
            0
          );

          await this.notifyAdmins(
            this.options.randomiseCompleteMessage
              .replace("{swappedPlayers}", totalSwaps)
              .replace("{team1Count}", team1Count)
              .replace("{team2Count}", team2Count)
          );

          this.verbose(1, `Final teams: ${JSON.stringify(this.savedTeams)}`);
          this.savedTeams = { Team1: [], Team2: [], Team0: [] };
          this.isScheduled = false;
          this.active = false;
        }
      }, this.options.checkInterval * 1000);
    } else {
      this.verbose(1, "No saved teams to randomise.");
    }
  }

  getSquadsToSwap(team) {
    const squads = Object.values(team).sort((a, b) => b.length - a.length);
    const toSwap = [];
    squads.forEach((squad, index) => {
      if (index % 2 !== 0) {
        toSwap.push(...squad);
      }
    });
    return toSwap;
  }

  async attemptSwaps(playersToSwap, targetTeamID) {
    const players = this.server.players.slice(0);
    let swaps = 0;

    for (const player of playersToSwap) {
      const serverPlayer = players.find((p) => p.eosID === player.eosID);
      if (serverPlayer) {
        if (serverPlayer.teamID !== targetTeamID) {
          this.verbose(
            1,
            `Swapping player ${player.name} to team ${targetTeamID}`
          );

          try {
            await this.server.rcon.switchTeam(player.eosID);
            await this.server.rcon.warn(
              player.eosID,
              this.options.swapWarningMessage
            );
            swaps++;
          } catch (error) {
            this.verbose(
              1,
              `Failed to swap player ${player.name}: ${error.message}`
            );
            continue; // Continue even if one swap fails
          }

          playersToSwap.splice(playersToSwap.indexOf(player), 1); // Remove from list after successful swap
        } else {
          this.verbose(
            1,
            `Player ${player.name} is already on team ${targetTeamID}`
          );
          playersToSwap.splice(playersToSwap.indexOf(player), 1); // Remove from list
        }
      } else {
        this.verbose(
          1,
          `Player ${player.name} not found in the server, will check again later`
        );
        // Do not remove the player from the list, assume they may join later
      }
    }

    return swaps; // Return the number of successful swaps
  }

  async finalBalanceCheck() {
    const team1Count = Object.values(this.savedTeams.Team1).reduce(
      (count, squad) => count + squad.length,
      0
    );
    const team2Count = Object.values(this.savedTeams.Team2).reduce(
      (count, squad) => count + squad.length,
      0
    );
    const difference = Math.abs(team1Count - team2Count);

    if (difference > 3) {
      const largerTeam = team1Count > team2Count ? "Team1" : "Team2";
      const smallerTeam = largerTeam === "Team1" ? "Team2" : "Team1";

      const unassignedPlayers = this.savedTeams.Team0;

      while (
        unassignedPlayers.length > 0 &&
        Math.abs(team1Count - team2Count) > 3
      ) {
        const player = unassignedPlayers.pop();
        this.savedTeams[smallerTeam].push(player);
        this.verbose(
          1,
          `Balancing teams by moving unassigned player ${player.name}`
        );
         await this.server.rcon.switchTeam(player.eosID); // Swap the unassigned player
      }
    }
  }

  async notifyAdmins(message) {
    try {
      const admins = await this.server.getAdminsWithPermission(
        "canseeadminchat"
      );
      for (const player of this.server.players) {
        if (admins.includes(player.steamID)) {
          await this.server.rcon.warn(player.eosID, message);
        }
      }
    } catch (error) {
      this.verbose(
        1,
        `Failed to notify admins: ${error.message}. Sending error message to admins.`
      );
      const errorMessage = this.options.randomiseFailedMessage;
      for (const player of this.server.players) {
        if (admins.includes(player.steamID)) {
          await this.server.rcon.warn(player.eosID, errorMessage);
        }
      }
    }
  }
}
