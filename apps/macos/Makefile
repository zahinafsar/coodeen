PROJECT := Coodeen.xcodeproj
SCHEME := Coodeen
BUILD_DIR := build
ARCHIVE := $(BUILD_DIR)/Coodeen.xcarchive
EXPORT_DIR := $(BUILD_DIR)/export
APP := $(EXPORT_DIR)/Coodeen.app
DMG := $(BUILD_DIR)/Coodeen-mac-$(shell uname -m).dmg
DIST_DIR := $(BUILD_DIR)/dist
RELEASE_APP := $(BUILD_DIR)/DerivedData/Build/Products/Release/Coodeen.app
SIGN_IDENTITY ?= Developer ID Application
TEAM_ID ?=

.PHONY: gen build run release dist version archive export notarize dmg clean

gen:
	xcodegen generate

build: gen
	xcodebuild -project $(PROJECT) -scheme $(SCHEME) -configuration Debug -derivedDataPath $(BUILD_DIR)/DerivedData -skipPackagePluginValidation -skipMacroValidation build

run: build
	-pkill -x Coodeen; sleep 1
	open -n $(BUILD_DIR)/DerivedData/Build/Products/Debug/Coodeen.app

release: gen
	xcodebuild -project $(PROJECT) -scheme $(SCHEME) -configuration Release -derivedDataPath $(BUILD_DIR)/DerivedData -skipPackagePluginValidation -skipMacroValidation CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM= build

dist: release
	bash scripts/package.sh "$(RELEASE_APP)" "$(DIST_DIR)"

version:
	@sed -n 's/^ *MARKETING_VERSION: *"\(.*\)"/\1/p' project.yml

archive: gen
	xcodebuild -project $(PROJECT) -scheme $(SCHEME) -configuration Release -archivePath $(ARCHIVE) -skipPackagePluginValidation -skipMacroValidation CODE_SIGN_IDENTITY="$(SIGN_IDENTITY)" DEVELOPMENT_TEAM="$(TEAM_ID)" archive

export: archive
	xcodebuild -exportArchive -archivePath $(ARCHIVE) -exportPath $(EXPORT_DIR) -exportOptionsPlist scripts/ExportOptions.plist

notarize: export
	bash scripts/notarize.sh "$(APP)"

dmg:
	bash scripts/make-dmg.sh "$(APP)" "$(DMG)"

clean:
	rm -rf $(BUILD_DIR) $(PROJECT)
