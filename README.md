# Sync-safe file names

Ensure your [Obsidian](https://obsidian.md/) files can always be synced across all your devices.

## What is the problem?

Sometimes I have special characters in my file names on my desktop, like `?`. When I open the app on my phone, I get a notification that says that some of those files cannot be synced. Those special characters, like `?`, prevent the file from being synced to my phone.

This plugin helps you rename all your files to only contain safe characters, by replacing all unsafe characters with a hypen, `-`. So "Invalid?.md" becomes "Invalid-.md". The plugin can also automatically rename all new files you create or change the name of, but it will never overwrite an exisiting file.

## Getting started

1. [Install](https://help.obsidian.md/community-plugins) the plugin.
2. Automatic renaming is activated by default. You can change this in the plugin settings.
3. Open a new file, edit the content and run the command "Insert report of all unsafe file names".
4. If you are happy with the plan, run the command "Rename all files to be sync-safe".
