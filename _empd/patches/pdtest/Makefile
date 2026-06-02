LIBPD_DIR = ../../libpd/

SRC_FILES = pdtest.c
TARGET = pdtest.html

CFLAGS = -I$(LIBPD_DIR)/pure-data/src -I$(LIBPD_DIR)/libpd_wrapper -O3
LDFLAGS = -L$(LIBPD_DIR)/build/libs -lpd -lm

.PHONY: clean clobber

$(TARGET): $(SRC_FILES) test.pd
    # To add externals:
	#emcc $(CFLAGS) -o moog~.o moog~.c
	#emcc $(CFLAGS) -o comb.o externals/comb.c
	#emcc $(CFLAGS) -o gate.o externals/gate.c
	#emcc $(CFLAGS) -o kink.o externals/kink.c
	#emcc $(CFLAGS) -o lookup.o externals/lookup.c
	#emcc $(CFLAGS) -o tanh.o externals/tanh.c
	
    emcc $(CFLAGS) -o $(TARGET) $(SRC_FILES) --closure 1 -s USE_SDL=2 -s ERROR_ON_UNDEFINED_SYMBOLS=0 --preload-file test.pd $(LDFLAGS)

clean:
	rm -f $(OUTPUT_FILES)
	