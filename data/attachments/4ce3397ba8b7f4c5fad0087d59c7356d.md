# Page snapshot

```yaml
- generic [ref=e6]:
  - form [ref=e9]:
    - generic [ref=e10]:
      - generic [ref=e11]:
        - generic: Username *
        - textbox "Username *" [ref=e12]: tmsqa@1
      - generic [ref=e14]:
        - generic: Password *
        - generic:
          - generic:
            - generic:
              - textbox "Password *" [ref=e15]: Password@3
              - button "SHOW" [ref=e17] [cursor=pointer]
      - checkbox "remember" [ref=e18] [cursor=pointer]:
        - generic [ref=e21]: Remember my username
      - button "Sign In" [ref=e22] [cursor=pointer]
      - link "Problems signing in?" [ref=e23] [cursor=pointer]:
        - /url: problemsigningin
      - paragraph [ref=e25]: Invalid username or password. Please check your username and password and try again.
  - button "TEST DRIVE" [ref=e26] [cursor=pointer]
  - paragraph [ref=e28]: Take us for a spin! Click TEST DRIVE for an interactive demo of security, video, video doorbell, automation, geofence arming reminders and more.
  - button "Copyright © 2026 Resideo Technologies, Inc." [ref=e29] [cursor=pointer]:
    - paragraph [ref=e30]: Copyright © 2026 Resideo Technologies, Inc.
```