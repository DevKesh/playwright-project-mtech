# TC Smoke Test Suite

> login: true
> locators: getByRole, getByLabel, getByText
> output: tests/generated/smoke
> pages: framework/pages/generated/smoke
> tags: @smoke @tc @tc-plan

---

## TC-SMOKE-001: Login and verify home page
**Entry:** User is on the Total Connect login page
**Exit:** User sees the home page with security panel status visible

login to the app
dismiss cookie popup if visible
close any pop up that occurs by clicking on DONE
verify the home page is loaded and the URL contains /home

## TC-SMOKE-002: Arm Home and Disarm
**Entry:** User is logged in and on home page with partitions showing Disarmed
**Exit:** All partitions return to Disarmed status after arming and disarming

login to the app
dismiss cookie popup if visible
close any pop up that occurs by clicking on DONE
click on the text "SELECT ALL" to select all partitions
click the button with text "Arm Home" that appears after selecting partitions
wait for the text "Armed Home" to become visible on the page (timeout 30 seconds)
verify the partition status text shows "Armed Home"
click on the text "SELECT ALL" to select all partitions again
click the button with text "Disarm" that appears after selecting partitions
wait for the text "Disarmed" to become visible on the page (timeout 30 seconds)
verify the partition status text shows "Disarmed"

## TC-SMOKE-003: Navigate to Devices page
**Entry:** User is logged in and on home page
**Exit:** Devices page is visible with URL /automation

login to the app
dismiss cookie popup if visible
close any pop up that occurs by clicking on DONE
click the sidebar navigation button with text "Devices" to navigate to Devices
verify the URL contains /automation
verify at least one device or device category is visible on the page

## TC-SMOKE-004: Navigate to Cameras page
**Entry:** User is logged in and on home page
**Exit:** Cameras page loads with camera feed section

login to the app
dismiss cookie popup if visible
close any pop up that occurs by clicking on DONE
click the sidebar navigation button with text "Cameras" to navigate to Cameras
verify the URL contains /cameras
verify the cameras page is loaded

## TC-SMOKE-005: Navigate to Activity page
**Entry:** User is logged in and on home page
**Exit:** Activity log entries are visible with timestamps

login to the app
dismiss cookie popup if visible
close any pop up that occurs by clicking on DONE
click the sidebar navigation button with text "Activity" to navigate to Activity
verify the URL contains /events
verify the activity log entries are displayed

## TC-SMOKE-006: Verify all cameras are visible on Cameras page
**Entry:** User is logged in and on home page
**Exit:** Cameras page shows all available camera feeds

login to the app
dismiss cookie popup if visible
close any pop up that occurs by clicking on DONE
click the sidebar navigation button with text "Cameras" to navigate to Cameras
verify the URL contains /cameras
verify that all cameras on the page are visible and present
verify the number of cameras displayed is greater than zero

## TC-SMOKE-007: Verify camera names are displayed on Cameras page
**Entry:** User is logged in and on home page
**Exit:** Each camera on the page has a visible name or label

login to the app
dismiss cookie popup if visible
close any pop up that occurs by clicking on DONE
click the sidebar navigation button with text "Cameras" to navigate to Cameras
verify the URL contains /cameras
verify each camera displayed has a name or label visible
verify no camera name is empty or missing

## TC-SMOKE-008: Verify camera feed sections load on Cameras page
**Entry:** User is logged in and on home page
**Exit:** Camera feed sections are fully loaded without errors

login to the app
dismiss cookie popup if visible
close any pop up that occurs by clicking on DONE
click the sidebar navigation button with text "Cameras" to navigate to Cameras
verify the URL contains /cameras
verify camera feed sections are loaded and visible on the page
verify no loading indicators or error messages are displayed
