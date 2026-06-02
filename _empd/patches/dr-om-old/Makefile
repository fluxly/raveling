LIBPD_DIR = ../../libpd

SRC_FILES = drom.c
TARGET = drom.html
PDFILENAME = drom.pd

CFLAGS = -I$(LIBPD_DIR)/pure-data/src -I$(LIBPD_DIR)/libpd_wrapper -I./externals -s USE_SDL_MIXER=2 -O3
LDFLAGS = -L$(LIBPD_DIR)/build/libs -L./externals -lpd -lm

.PHONY: clean clobber

$(TARGET): $(SRC_FILES) $(PDFILENAME)
	emcc $(CFLAGS) -o moog~.o -c moog~.c
	emcc $(CFLAGS) -o $(TARGET) $(SRC_FILES) --closure 1 -s USE_SDL=2 -s ERROR_ON_UNDEFINED_SYMBOLS=0 --preload-file $(PDFILENAME) $(LDFLAGS)
