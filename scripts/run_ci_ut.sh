#!/bin/bash
# Copyright (c) 2024 Huawei Device Co., Ltd.
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

set -x

if [ -z "${ROOT_DIR+x}" ]; then
  export ROOT_DIR=$(pwd)
  echo "ROOT_DIR was not set. Initialized to $ROOT_DIR"
else
  echo "ROOT_DIR is already set to $ROOT_DIR"
fi

NODE_VERSION=v22.3.0
NODE_HOME=$ROOT_DIR/pre_scripts/node-$NODE_VERSION-linux-x64
NODE_URL=https://gitee.com/muya318/pre_scripts/raw/master/node-v22.3.0-linux-x64.tar.gz
NODE_BIN=node-v22.3.0-linux-x64.tar.gz

prepare_nodejs() {
  echo "### preparing nodejs"
  if [ ! -d "$NODE_HOME" ]; then
    cd $ROOT_DIR/pre_scripts
    tar -xf $NODE_BIN
    chmod 777 $NODE_HOME/bin/*
    cd -
    export PATH=$NODE_HOME/bin:$PATH
  fi
  npm config set registry=https://repo.huaweicloud.com/repository/npm/
  npm config set strict-ssl false
  echo "###nodejs env ready"
}

git clone https://gitee.com/muya318/pre_scripts.git

prepare_nodejs

pwd
cd $ROOT_DIR

node -v
npm -v

npm install
npm run test

if [ $? -ne 0 ]; then
  echo "************* Unit test failed *************"
  exit 1
fi

echo "************* Unit test success *************"

npm pack
if [ $? -ne 0 ]; then
  echo "************* Npm pack failed *************"
  exit 1
fi
echo "************* Npm pack success *************"

exit 0