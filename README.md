# BetterRandomiser Plugin

The `BetterRandomiser` plugin provides an automated system for randomising teams at the start of a new game, prioritising keeping squads intact. This plugin is ideal for preventing clan stacking.

## Features

- **Squad Integrity**: Prioritises keeping squad members together during team randomisation.
- **Stop Randomisation**: Admins can stop the scheduled team randomisation if necessary.
- **Intervalled Updates**: Periodically updates the team list every 5 minutes until the new game starts.
- **Broadcasts**: Informs players about upcoming randomisations and cancellations via server broadcasts.

## Admin Commands

- **Start Randomisation**: Initiates the team randomisation process.
  - Default Command: `!randomise`
  - **Usage**: Type the command in the in-game admin chat to start the process.

- **Stop Randomisation**: Cancels the scheduled team randomisation.
  - Default Command: `!stoprandomise`
  - **Usage**: Type the command in the in-game admin chat to stop the process.

## Configuration Options

The following options can be configured in the plugin's configuration file:

- **command**: The command used to initiate team randomisation.
  - **Default**: `!randomise`
  
- **stopCommand**: The command used to stop the team randomisation.
  - **Default**: `!stoprandomise`

- **startBroadcast**: The message broadcasted when the team randomisation is scheduled.
  - **Default**: `We will be shuffling teams at the start of next game. We will attempt to keep you together with your squad, but this isn't guaranteed. This system is automated.`

- **stopBroadcast**: The message broadcasted when the team randomisation is cancelled.
  - **Default**: `Team randomisation has been cancelled.`

- **warnPlayerMessage**: The message sent to warn players before team randomisation.
  - **Default**: `Initiating team randomise. You may be swapped.`

- **alreadyScheduledMessage**: The message sent to the player if team randomisation is already scheduled.
  - **Default**: `Team randomisation is already scheduled.`

- **notScheduledMessage**: The message sent to the player if team randomisation has not been scheduled yet.
  - **Default**: `Team randomisation has not been scheduled yet.`


## Example Configuration

```json
{
  "plugin": "BetterRandomiser",
  "enabled": true,
  "command": "randomise",
  "stopCommand": "stoprandomise",
  "startBroadcast": "We will be shuffling teams at the start of next game. We will attempt to keep you together with your squad, but this isn't guaranteed. This system is automated.",
  "stopBroadcast": "Team randomisation has been cancelled.",
  "warnPlayerMessage": "Initiating team randomise. You may be swapped.",
  "alreadyScheduledMessage": "Team randomisation is already scheduled.",
  "notScheduledMessage": "Team randomisation has not been scheduled yet."
}
