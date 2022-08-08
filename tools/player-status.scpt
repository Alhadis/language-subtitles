#!/usr/bin/osascript

(**
 * Print information about the currently active media player(s).
 *
 * Output is formatted as YAML; multiple players will generate
 * multiple YAML documents (separated by “---” markers). Field
 * data is written to the standard error stream instead of the
 * standard output - this is a limitation of AppleScript.
 *)
on run argv
	set emittedOutput to false
	
	if application "VLC" is running then
		tell application "VLC"
			set emittedOutput to true
			log "audioDesync: "  & audio desync
			log "volume: "       & audio volume ÷ 256
			
			try
				set filePath to path of current item
				if length of filePath ≥ 1 then
					log "file: "
					log " name: " & name of current item
					log " path: " & filePath
				else
					log "file: null"
				end if
			on error errString number errCode
				if errCode equals -2753 then ¬
					set errString to "No file currently playing"
				log "file: null"
				log "error: "
				log " text: " & errString
				log " code: " & errCode
			end try
			
			log "isDVDMenu: "    & playback shows menu
			log "isFullScreen: " & fullscreen mode
			log "isMuted: "      & muted
			log "isPlaying: "    & playing
			log "time:"
			log " current: " & current time
			log " total: "   & duration of current item
		end tell
	else
		log "error: not-running"
	end if
	
	if application "QuickTime Player" is running then
		tell first document of application "QuickTime Player"
			if emittedOutput then
				log linefeed & "---"
			else
				set emittedOutput to true
			end if
			
			log "volume: "     & audio volume
			log "dataRate: "   & data rate
			log "dataSize: "   & data size
			log "isLooping: "  & looping
			log "isMuted: "    & muted
			log "dimensions: " & natural dimensions
			
			log "time:"
			log " current: " & current time
			log " total: "   & duration
		end tell
	end if
end
