//Install networking kill tool
yum install lsof

//create user for production
useradd -s /bin/bash -m -d /home/produser -c "Production User" produser
passwd produser
usermod -aG wheel produser
su produser

//install dependency app
sudo curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash

//Have to restart and login as produser..
nvm list-remote
nvm install stable
nvm alias default node
npm install pm2 -g

//insert server source code, telepod_details.js and serviceAccountKey.json
npm install
pm2 startOrGracefulReload launcher.json

FAQ:
Question 1:
Error: listen EADDRINUSE: address already in use :::3000

Answer 1:
Run the following command to close the process using the port 3000:
STEP 1) lsof -i tcp:3000
STEP 2) kill -9 <PID_HERE>

Question 2:
How to run single standalone server?

Answer 2:
Run the following command:
node app.js