LIBPD_DIR = ../../libpd

SRC_FILES = noisemusick.c
TARGET = noisemusick
PDFILENAME = noisemusick.pd
SHELLFILE = noisemusick-shell.html

CFLAGS = -I$(LIBPD_DIR)/pure-data/src -I$(LIBPD_DIR)/libpd_wrapper -I./externals -s USE_SDL_MIXER=2 -O3
LDFLAGS = -L$(LIBPD_DIR)/build/libs -L./externals -L./externals/common -lpd -lm

.PHONY: clean clobber

$(TARGET).html: $(SRC_FILES) $(PDFILENAME)

	emcc $(CFLAGS) -o externals/shared.o -c externals/shared.c
	emcc $(CFLAGS) -o externals/common/magicbit.o -c externals/common/magicbit.c
	emcc $(CFLAGS) -o externals/loud.o -c externals/loud.c
	emcc $(CFLAGS) -o externals/sic.o -c externals/sic.c 
	emcc $(CFLAGS) -o externals/arsic.o -c externals/arsic.c  
	emcc $(CFLAGS) -o externals/fitter.o -c externals/fitter.c 
	emcc $(CFLAGS) -o externals/fragile.o -c externals/fragile.c 
	emcc $(CFLAGS) -o externals/comb.o -c externals/comb.c 
	emcc $(CFLAGS) -o externals/gate.o -c externals/gate.c 
	emcc $(CFLAGS) -o externals/kink.o -c externals/kink.c 
	emcc $(CFLAGS) -o externals/lookup.o -c externals/lookup.c 
	emcc $(CFLAGS) -o externals/tanh.o -c externals/tanh.c 
	emcc $(CFLAGS) -o externals/vefl.o -c externals/vefl.c 
	emcc $(CFLAGS) -o $(TARGET).html $(SRC_FILES) --shell-file $(SHELLFILE) --closure 1 -s USE_SDL=2 -sALLOW_MEMORY_GROWTH -s ERROR_ON_UNDEFINED_SYMBOLS=0 --preload-file $(PDFILENAME) $(LDFLAGS)

clean:
	rm -f $(TARGET).js $(TARGET).wasm $(TARGET).html $(TARGET).data
