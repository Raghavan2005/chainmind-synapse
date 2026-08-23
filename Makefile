.PHONY: test contracts train api ingest demo fmt

contracts:
	cd contracts && forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.4.0 --no-git --shallow
	cd contracts && forge test -vv

test:
	cd contracts && forge test -vv
	pytest -q

train:
	python -m services.score.train

api:
	uvicorn services.api.main:app --host 0.0.0.0 --port 8000

ingest:
	python -m services.ingest.watch

demo:
	bash scripts/demo_flow.sh
