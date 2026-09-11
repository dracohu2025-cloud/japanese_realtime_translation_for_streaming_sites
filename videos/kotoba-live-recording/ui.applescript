on run argv
 set wanted to item 1 of argv
 tell application "System Events"
  tell process "Google Chrome"
   repeat with win in windows
    set winPosition to position of win
    if item 1 of winPosition is 100 or (item 1 of winPosition > 900 and item 1 of winPosition < 1200) then
    set elementsList to entire contents of win
    repeat with uiItem in elementsList
     try
      if role of uiItem is "AXButton" and name of uiItem is wanted then
       click uiItem
       return "Clicked: " & wanted
      end if
     end try
    end repeat
    end if
   end repeat
  end tell
 end tell
 error "Button not found: " & wanted
end run
