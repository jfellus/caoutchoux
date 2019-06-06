install:
		echo "#!/bin/bash" > /usr/local/bin/caoutchoux
		echo `readlink -f ./editor/editor` '$$*' >> /usr/local/bin/caoutchoux
		chmod a+x  /usr/local/bin/caoutchoux
