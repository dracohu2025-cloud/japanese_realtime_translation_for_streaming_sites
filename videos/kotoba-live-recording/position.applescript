on run argv
 tell application "System Events" to tell process "Google Chrome"
  set elementsList to entire contents of (first window whose name contains "日语听力工作室")
  repeat with uiItem in elementsList
   try
    if role of uiItem is "AXButton" and name of uiItem is item 1 of argv then return {position of uiItem, size of uiItem}
   end try
  end repeat
 end tell
 error "Button not found"
end run
