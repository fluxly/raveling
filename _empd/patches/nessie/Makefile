LIBPD_DIR = ../../libpd

SRC_FILES = nessie.c
TARGET = nessie
PDFILENAME = nessie.pd
SHELLFILE = nessie-shell.html

CFLAGS = -I$(LIBPD_DIR)/pure-data/src -I$(LIBPD_DIR)/libpd_wrapper -I./externals -s USE_SDL_MIXER=2 -O3
LDFLAGS = -L$(LIBPD_DIR)/build/libs -L./externals -lpd -lm

.PHONY: clean clobber

$(TARGET).html: $(SRC_FILES) $(PDFILENAME)
	emcc $(CFLAGS) -o $(TARGET).html $(SRC_FILES) --shell-file $(SHELLFILE) --closure 1 \
	    -s USE_SDL=2 -s ASSERTIONS -s ALLOW_MEMORY_GROWTH -s ERROR_ON_UNDEFINED_SYMBOLS=0 \
		-s EXPORTED_RUNTIME_METHODS=['cwrap','ccall'] \
		-s EXPORTED_FUNCTIONS="['_main','_pdprint','_sendfloat']" \
		--preload-file $(PDFILENAME) $(LDFLAGS)

clean:
	rm -f $(TARGET).js $(TARGET).wasm $(TARGET).html $(TARGET).data
