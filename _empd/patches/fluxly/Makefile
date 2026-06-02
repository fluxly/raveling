LIBPD_DIR = ../../libpd

SRC_FILES = fluxly.c
TARGET = fluxly
PDFILENAME = fluxly.pd
SHELLFILE = fluxly-shell.html

CFLAGS = -I$(LIBPD_DIR)/pure-data/src -I$(LIBPD_DIR)/libpd_wrapper -I./externals -s USE_SDL_MIXER=2 -O3
LDFLAGS = -L$(LIBPD_DIR)/build/libs -L./externals -lpd -lm

.PHONY: clean clobber

$(TARGET).html: $(SRC_FILES) $(PDFILENAME)
	emcc $(CFLAGS) -o $(TARGET).html $(SRC_FILES) --shell-file $(SHELLFILE) --closure 1 -s USE_SDL=2 -s ERROR_ON_UNDEFINED_SYMBOLS=0 --preload-file $(PDFILENAME) $(LDFLAGS)

clean:
	rm -f $(TARGET).js $(TARGET).wasm $(TARGET).html $(TARGET).data
