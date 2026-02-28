#!/bin/bash
sed -i '/^pick bb25364/s/pick/drop/' "$1"
sed -i '/^pick ade3b76/s/pick/drop/' "$1"
