# TC Smoke Test Suite

## TC-SMOKE-001: Login and verify dashboard
> login: true
login to the app
dismiss cookie popup if visible
close any pop up that occurs by clicking on DONE
verify the dashboard page is loaded and visible

## TC-SMOKE-002: Arm Home mode
> login: true
login to the app
dismiss cookie popup if visible
close any pop up that occurs by clicking on DONE
click on SELECT ALL
click on ARM HOME
wait till the partitions status changes to Armed Home
verify the status shows Armed Home

## TC-SMOKE-003: Navigate to Devices page
> login: true
login to the app
dismiss cookie popup if visible
close any pop up that occurs by clicking on DONE
navigate to the Devices page
verify the devices list is visible

## TC-SMOKE-004: Navigate to Cameras page
> login: true
login to the app
dismiss cookie popup if visible
close any pop up that occurs by clicking on DONE
navigate to the Cameras page
verify the cameras page is loaded

## TC-SMOKE-005: Navigate to Activity page
> login: true
login to the app
dismiss cookie popup if visible
close any pop up that occurs by clicking on DONE
navigate to the Activity page
verify the activity log entries are displayed
