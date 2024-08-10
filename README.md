# BetterRandomiser Plugin

The `BetterRandomiser` plugin provides an automated system for randomising teams at the start of a new game, prioritising keeping squads intact. This plugin is ideal for preventing clan stacking and ensuring balanced teams.

## Features

- **Squad Integrity**: Prioritises keeping squad members together during team randomisation.
- **Stop Randomisation**: Admins can stop the scheduled team randomisation if necessary.
- **Intervalled Updates**: Periodically updates the team list at configurable intervals until the new game starts.
- **Broadcasts**: Informs players about upcoming randomisations and cancellations via server broadcasts.
- **Continuous Checking**: Checks and swaps players for 60 seconds after a new game starts to ensure they are in the correct teams. After 60 seconds, balances teams if needed.
- **Admin Notifications**: Alerts admins when the randomisation process is complete or if it encounters any errors.

## Admin Commands

- **Start Randomisation**: Initiates the team randomisation process.
  - Default Command: `!randomise`
  - **Usage**: Type the command in the in-game admin chat to start the process.

- **Stop Randomisation**: Cancels the scheduled team randomisation.
  - Default Command: `!stoprandomise`
  - **Usage**: Type the command in the in-game admin chat to stop the process.

- **Force Randomisation**: Forces the randomisation process as if the new game started.
  - Default Command: `!forcerandomise`
  - **Usage**: Type the command in the in-game admin chat to force the process.

## Configuration Options

The following options can be configured in the plugin's configuration file:

- **command**: The command used to initiate team randomisation.
  - **Default**: `randomise`
  
- **stopCommand**: The command used to stop the team randomisation.
  - **Default**: `stoprandomise`

- **forceCommand**: The command used to force the team randomisation as if the new game started.
  - **Default**: `forcerandomise`

- **startBroadcast**: The message broadcasted when the team randomisation is scheduled.
  - **Default**: `We will be shuffling teams at the start of next game. We will attempt to keep you together with your squad, but this isn't guaranteed. This system is automated.`
  - **enableStartBroadcast**: Enable or disable the start broadcast.
  - **Default**: `true`

- **stopBroadcast**: The message broadcasted when the team randomisation is cancelled.
  - **Default**: `Team randomisation has been cancelled.`
  - **enableStopBroadcast**: Enable or disable the stop broadcast.
  - **Default**: `true`

- **intervalBroadcast**: The message broadcasted at intervals before the randomisation occurs.
  - **Default**: `We will be shuffling teams at the start of next game. We will attempt to keep you together with your squad, but this isn't guaranteed. This system is automated.`
  - **enableIntervalBroadcast**: Enable or disable the interval broadcast.
  - **Default**: `true`
  - **intervalTime**: The interval time in minutes for the interval broadcast.
  - **Default**: `5`

- **alreadyScheduledMessage**: The message sent to the player if team randomisation is already scheduled.
  - **Default**: `Team randomisation is already scheduled.`

- **notScheduledMessage**: The message sent to the player if team randomisation has not been scheduled yet.
  - **Default**: `Team randomisation has not been scheduled yet.`

- **forceNotActiveMessage**: The message sent to the player if they try to force randomisation when it is not active.
  - **Default**: `Team randomisation is not currently active.`

- **swapWarningMessage**: The message sent to a player when they are swapped to the other team.
  - **Default**: `You have been automatically swapped to balance the teams.`

- **randomiseCompleteMessage**: The message sent to admins when randomisation is complete.
  - **Default**: `Randomise completed\n| Swapped {swappedPlayers} players\n| Team 1: {team1Count} players\n| Team 2: {team2Count} players`

- **randomiseFailedMessage**: The message sent to admins if randomisation fails.
  - **Default**: `!!!Randomise Failed!!!\n| Check SquadJS Logs`

- **checkInterval**: The interval in seconds for checking and swapping players after the new game starts.
  - **Default**: `5`

- **totalCheckTime**: The total time in seconds to continue checking and swapping players after the new game starts.
  - **Default**: `60`

- **updateSquadListInterval**: The interval time in minutes for updating the squad list periodically.
  - **Default**: `5`

## Example Configuration

```json
{
  "plugin": "BetterRandomiser",
  "enabled": true,
  "command": "randomise",
  "stopCommand": "stoprandomise",
  "forceCommand": "forcerandomise",
  "startBroadcast": "We will be shuffling teams at the start of next game. We will attempt to keep you together with your squad, but this isn't guaranteed. This system is automated.",
  "enableStartBroadcast": true,
  "stopBroadcast": "Team randomisation has been cancelled.",
  "enableStopBroadcast": true,
  "intervalBroadcast": "We will be shuffling teams at the start of next game. We will attempt to keep you together with your squad, but this isn't guaranteed. This system is automated.",
  "enableIntervalBroadcast": true,
  "intervalTime": 5,
  "alreadyScheduledMessage": "Team randomisation is already scheduled.",
  "notScheduledMessage": "Team randomisation has not been scheduled yet.",
  "forceNotActiveMessage": "Team randomisation is not currently active.",
  "swapWarningMessage": "You have been automatically swapped to balance the teams.",
  "randomiseCompleteMessage": "Randomise completed\n| Swapped {swappedPlayers} players\n| Team 1: {team1Count} players\n| Team 2: {team2Count} players",
  "randomiseFailedMessage": "!!!Randomise Failed!!!\n| Check SquadJS Logs",
  "checkInterval": 5,
  "totalCheckTime": 60,
  "updateSquadListInterval": 5
}
