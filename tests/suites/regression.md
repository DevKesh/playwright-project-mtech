# TC Regression Test Suite

> login: true
> locators: getByRole, getByLabel, getByText
> output: tests/generated/regression
> pages: framework/pages/generated/regression
> tags: @regression @tc @tc-plan

---

## TC-REG-001: Complete Login Flow
**Entry:** User is on the Total Connect login page (unauthenticated)
**Exit:** User is on the home page with security panel visible, all popups dismissed

navigate to the login page
dismiss cookie consent banner if visible
fill the username field with configured credentials
fill the password field with configured credentials
click the Sign In button
wait for the URL to contain /home
dismiss the security notifications popup by toggling switch and clicking DONE
verify the home page is loaded

## TC-REG-002: Login with invalid credentials
**Entry:** User is on the Total Connect login page
**Exit:** Error message is displayed, user remains on login page

navigate to the login page
dismiss cookie consent banner if visible
fill the username field with "invalid@user.com"
fill the password field with "WrongPassword123"
click the Sign In button
verify an error message is displayed on the page
verify the URL still contains /login

## TC-REG-003: Security Panel Tab Navigation
**Entry:** User is logged in and on the home page
**Exit:** All three tabs (Security, Partitions, Sensors) are accessible and display content

login to the app
dismiss cookie popup if visible
close any pop up that occurs by clicking on DONE
click on the Security tab in the panel
verify security tab content is visible
click on the Partitions tab
verify partitions content is visible
click on the Sensors tab
verify sensors list is visible

## TC-REG-004: Arm Away and Disarm
**Entry:** User is logged in, system is in Disarmed state
**Exit:** System returns to Disarmed state after Arm Away cycle

login to the app
dismiss cookie popup if visible
close any pop up that occurs by clicking on DONE
click on SELECT ALL
click on ARM AWAY
wait till the partitions status changes to Armed Away
verify the status shows Armed Away
click on DISARM
wait till the partitions status changes to Disarmed
verify the status shows Disarmed

## TC-REG-005: Devices Page — View Device List
**Entry:** User is logged in and on the home page
**Exit:** User is on Devices page with at least one device category visible

login to the app
dismiss cookie popup if visible
close any pop up that occurs by clicking on DONE
click on Devices in the sidebar navigation
verify the URL contains /automation
verify at least one device card or device category is displayed on the page

## TC-REG-006: Cameras Page — View Camera Feeds
**Entry:** User is logged in and on the home page
**Exit:** Cameras page loads with camera feed panels visible

login to the app
dismiss cookie popup if visible
close any pop up that occurs by clicking on DONE
click on Cameras in the sidebar navigation
verify the cameras page is loaded
verify at least one camera feed panel is visible

## TC-REG-007: Activity Log — View and Verify Entries
**Entry:** User is logged in and on the home page
**Exit:** Activity log page shows recent entries with timestamps

login to the app
dismiss cookie popup if visible
close any pop up that occurs by clicking on DONE
click on Activity Logs in the sidebar navigation
verify the activity log page is loaded
verify activity entries are displayed with timestamps
verify the entries are ordered by most recent first

## TC-REG-008: Scenes Page — View Scenes List
**Entry:** User is logged in and on the home page
**Exit:** Scenes page loads with scene cards visible

login to the app
dismiss cookie popup if visible
close any pop up that occurs by clicking on DONE
click on Scenes in the sidebar navigation
verify the scenes page is loaded
verify at least one scene card is visible with a name

## TC-REG-009: Forgot Password Flow
**Entry:** User is on the login page (unauthenticated)
**Exit:** Forgot password form is displayed

navigate to the login page
dismiss cookie consent banner if visible
click on the Problems Signing In link
verify the forgot password or account recovery page is displayed
verify there is a form field for email or username

## TC-REG-010: Cross-Page Navigation Roundtrip
**Entry:** User is logged in and on the home page
**Exit:** User can navigate to all main pages and return to home

login to the app
dismiss cookie popup if visible
close any pop up that occurs by clicking on DONE
click on Devices in the sidebar
verify URL contains /automation
click on Cameras in the sidebar
verify cameras page loaded
click on Activity Logs in the sidebar
verify activity page loaded
click on Scenes in the sidebar
verify scenes page loaded
click on Security in the sidebar
verify the home/security page is loaded with URL containing /home
