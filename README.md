# Retcon

A card game about time travel for 2–4 players. You are one of the rival inventors of time travel, sending agents back through history to secure your own family line and undo your rivals'. Win the fight over the present and you earn the power to rewrite the past.

You play against 1–3 computer opponents, in your web browser.

## Download and play

1. Go to [**Releases**](../../releases/latest) and download the `Retcon-v….zip` file under **Assets**.
2. Unzip it.
3. **Windows:** double-click **Play Retcon**. A small black window opens and the game opens in your browser. Keep that window open while you play.
   **Mac or Linux:** open Terminal in the unzipped folder and type `python3 Retcon.pyz`, then open the address it shows.

Retcon needs [Python](https://www.python.org/downloads/) 3.8 or newer (free). On Windows, if Python isn't installed, **Play Retcon** opens the download page for you.

## How to play

**The goal:** be the first to **lock 3 timelines**.

The game starts with a single timeline. Each timeline has a **history** (cards already in the past) and a **Present**, where a trick is played each round. As the game goes on, timelines rupture and split, so the board grows.

### A round

1. **Refill.** Draw up to one card per open timeline, plus two.
2. **The Present.** On each timeline in turn, everyone plays one card **facedown** into that timeline's trick.
3. **The Past.** On each timeline again, you may do one thing:
   - **send a card back** facedown into that timeline's history (it costs **charge**: 1 for each step back in time),
   - **draw** a card,
   - **recall** any card from the face-up discard pile (3 charge), or
   - **pass**.
4. **The sweep.** Each timeline's history replays from the earliest card to the latest, and each card acts as it's reached. Then the tricks are scored and their cards act.
5. **Locks.** Any timeline where a player now has enough lineage locks for them.
6. This round's tricks become part of history, and the next round begins.

### Tricks and charge

- The highest card wins the trick, even if it is then killed or stolen. Ties go to the card played first.
- Most timelines have a **suit**: there, cards of that suit are trumps. The first timeline has no suit.
- The winner gains **3 charge**, and everyone else who played gains 1. Charge is what you spend to send cards back in time, so winning in the present lets you rewrite the past.

### Lineage and locks

- When the sweep reaches an **Ancestor**, whoever controls it adds a **lineage token** to that timeline.
- A timeline **locks** for you when you have **3 lineage** on it and strictly more than anyone else. Locked history is frozen: nothing can change it. Nothing locks before the first rupture, and a new timeline can't lock in the round it appears.
- The first player to lock **3 timelines** wins at once.

### Ruptures

- Every charge anyone spends sending cards back or recalling them adds to the table's **instability**.
- When it reaches the limit (7 with 2 players, 8 with 3, 9 with 4), the timeline being played **ruptures**: the player who pushed it over chooses where it splits. The new timeline shares all the history before that point, lineage included, and gets its own trick from the next round.
- There can be at most 5 timelines open at once.

## The cards

52 cards, 13 in each of four suits. Every card acts only on the card right next to it.

| Card | Value | What it does |
|---|---|---|
| **Ancestor** | 10 | Stays on the board. Adds its controller's lineage when the sweep reaches it. |
| **Assassin** | 8 | Kills the next card, whoever owns it, even yours. |
| **Sentinel** | 7 | Stays on the board and can't be killed. Guards its owner's cards next to it from a rival's Assassin or Executioner. |
| **Prophet** | 6 | Steals the next card. |
| **Executioner** | 5 | Kills the card just before it, whoever owns it. |
| **Usurper** | 4 | Removes a rival's lineage token from the Ancestor just before it. |
| **Revisionist** | 3 | Steals the card just before it, if it's a rival's. |
| **Wormhole** | 2 | Moves the card next to it one slot earlier, one slot later, or across to another timeline. |
| **Courier** | 1 | When reached, you may play a card from your hand in its place. |

The **Cards** button in the game has the full details, and the game replays each round step by step so you can see exactly what happened.
