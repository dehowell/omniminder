# Beeminding OmniFocus

This is a collection of scripts to link OmniFocus Pro up to my Beeminder goals. They may work with OmniFocus Pro 2, but I am exclusively testing with OmniFocus 3.

They are generally intended to run in response to the OmniFocus database file updating. Noodlesoft's Hazel is a straightforward way to attach a script to a file update. The OmniFocus automation is itself implemented using JavaScript for Automation, but executed from within the context of Node.js scripts so that they can interact with the Beeminder API conveniently.

Whenever the Omni Group introduces their own JavaScript automation engine into OmniFocus, I may loop that in as well. One project, three different JavaScript interpreters... fun!

These scripts are cobbled-together scaffolding for my own set-up! Feel free to clone and tinker, but I make no guarantee to fix any bugs relevant to your OS configuration, etc. I would _love_ to hear how your experience goes, though -- over time, I _may_ try to formalize these into a more general tool.

## Setup

TODO elaborate on these

1. Run `npm install`
2. Create `~/.bmndrrc`
3. Configure Hazel rule