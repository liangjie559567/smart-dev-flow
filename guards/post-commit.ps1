@echo off
REM post-commit.ps1 - Windows 版 checkpoint
set TAG=checkpoint-%date:~0,4%%date:~5,2%%date:~8,2%-%time:~0,2%%time:~3,2%%time:~6,2%
set TAG=%TAG: =0%
git tag "%TAG%" 2>nul && echo [smart-dev-flow] Checkpoint: %TAG%
